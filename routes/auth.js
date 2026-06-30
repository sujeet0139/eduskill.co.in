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
  
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const connection = await pool.getConnection();

    const [students] = await connection.query(
      'SELECT * FROM students WHERE email = ?',
      [email]
    );
    connection.release();

    if (students.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const student = students[0];

    // If password_hash is not set, fall back to reference_no for old accounts.
    // Otherwise, use secure bcrypt comparison.
    const isMatch = student.password_hash
      ? await bcrypt.compare(password, student.password_hash)
      : (password === student.reference_no);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate a secure session token (also sets the httpOnly session cookie)
    const token = issueSession(res, { id: student.id, email: student.email, role: 'student' });

    res.json({ success: true, token, student: { id: student.id, reference_no: student.reference_no, name: student.name, email: student.email, status: student.status } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// ADMIN LOGIN ENDPOINT
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const connection = await pool.getConnection();
    const [admins] = await connection.query(
      'SELECT * FROM admin_users WHERE email = ?',
      [email]
    );
    connection.release();

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
      connection.release();
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
    connection.release();

    // Send the email with the unhashed token
    await sendPasswordResetEmail(student.email, student.name, resetToken);

    res.json({ success: true, message: `Password reset email sent to ${student.email}.` });

  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: 'Failed to send password reset email', message: error.message });
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