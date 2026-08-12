const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { jwt, JWT_SECRET, COOKIE_NAME, MAX_AGE_MS, authCookieOptions } = require('../config/jwt');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../email');

// Sign a 24h JWT, set it as an httpOnly session cookie, and return it so older
// (Bearer-header) clients keep working during the cookie migration.
function issueSession(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  res.cookie(COOKIE_NAME, token, { ...authCookieOptions(), maxAge: MAX_AGE_MS });
  return token;
}

// STUDENT LOGIN ENDPOINT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    connection = await pool.getConnection();

    const [students] = await connection.query(
      'SELECT * FROM students WHERE email = ?',
      [email]
    );

    if (students.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const student = students[0];

    // If password_hash is not set, fall back to reference_no for old accounts.
    // Otherwise, use secure bcrypt comparison.
    const isLegacyAccount = !student.password_hash;
    const isMatch = student.password_hash
      ? await bcrypt.compare(password, student.password_hash)
      : (password === student.reference_no);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Legacy accounts were logging in with their public reference number as
    // the "password" -- that's printed on receipts and shared over WhatsApp/
    // email, so it's not really a secret. Migrate to a real bcrypt hash the
    // moment such an account successfully logs in, so this exposure closes
    // itself out over time without forcing a mass password reset.
    if (isLegacyAccount) {
      const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
      await connection.query('UPDATE students SET password_hash = ? WHERE id = ?', [passwordHash, student.id]);
    }

    // Generate a secure session token (also sets the httpOnly session cookie)
    const token = issueSession(res, { id: student.id, email: student.email, role: 'student' });

    res.json({ success: true, token, student: { id: student.id, reference_no: student.reference_no, name: student.name, email: student.email, status: student.status } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN LOGIN ENDPOINT
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    connection = await pool.getConnection();
    const [admins] = await connection.query(
      'SELECT * FROM admin_users WHERE email = ?',
      [email]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const admin = admins[0];

    if (!admin.is_active) {
      return res.status(401).json({ error: 'Admin account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = issueSession(res, { id: admin.id, role: admin.role, email: admin.email });

    return res.json({ success: true, token, admin: { email: admin.email, role: admin.role, name: admin.name } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error during admin login' });
  } finally {
    if (connection) connection.release();
  }
});

// TEACHER LOGIN — verifies against teachers.email + password_hash.
router.post('/teacher/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;
  try {
    if (!email || !password) return res.status(400).json({ error: 'Please provide email and password' });
    connection = await pool.getConnection();
    const [teachers] = await connection.query('SELECT * FROM teachers WHERE email = ?', [email]);
    if (teachers.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const teacher = teachers[0];
    if (teacher.status && teacher.status !== 'Active') {
      return res.status(401).json({ error: 'This teacher account is inactive.' });
    }
    if (!teacher.password_hash) {
      return res.status(401).json({ error: 'No password set. Please ask the admin to set your password.' });
    }
    const isMatch = await bcrypt.compare(password, teacher.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = issueSession(res, { id: teacher.id, email: teacher.email, role: 'teacher' });
    res.json({ success: true, token, teacher: { id: teacher.id, name: teacher.name, email: teacher.email, subject: teacher.subject } });
  } catch (error) {
    console.error('Teacher login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: REQUEST PASSWORD RESET FOR A STUDENT
router.post('/admin/request-password-reset', requireAdmin, async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [[student]] = await connection.query('SELECT id, email, name FROM students WHERE id = ?', [studentId]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Generate a secure, random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expiry to 1 hour from now
    const expiryDate = new Date(Date.now() + 3600000); // 1 hour

    await connection.query(
      'UPDATE students SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [hashedToken, expiryDate, student.id]
    );

    // Send the email with the unhashed token
    await sendPasswordResetEmail(student.email, student.name, resetToken);

    res.json({ success: true, message: `Password reset email sent to ${student.email}.` });

  } catch (error) {
    res.status(500).json({ error: 'Failed to send password reset email', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// STUDENT: SELF-SERVICE FORGOT PASSWORD
// Always responds success (avoids leaking which emails exist). If the email
// matches a student, emails them a reset link valid for 1 hour.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const [[student]] = await connection.query('SELECT id, email, name FROM students WHERE email = ?', [email]);
    if (student) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiryDate = new Date(Date.now() + 3600000); // 1 hour
      await connection.query(
        'UPDATE students SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
        [hashedToken, expiryDate, student.id]
      );
      await sendPasswordResetEmail(student.email, student.name, resetToken);
    }
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// RESET PASSWORD — verifies the emailed token and sets a new password.
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });

  let connection;
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    connection = await pool.getConnection();
    const [[student]] = await connection.query(
      'SELECT id FROM students WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [hashedToken]
    );
    if (!student) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await connection.query(
      'UPDATE students SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [passwordHash, student.id]
    );
    res.json({ success: true, message: 'Password has been reset. You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// LOGOUT — clears the session cookie. Stateless JWTs can't be revoked
// server-side, so this just removes the cookie from the browser.
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, authCookieOptions());
  res.json({ success: true });
});

// CURRENT SESSION — lets the frontend validate a session and read the role.
router.get('/me', requireAuth, (req, res) => {
  const { id, email, role } = req.user;
  res.json({ user: { id, email, role } });
});

module.exports = router;