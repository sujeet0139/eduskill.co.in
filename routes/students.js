const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendWelcomeEmail } = require('../email');
const { requireAdmin } = require('../middleware/authMiddleware');

// STUDENT REGISTRATION ENDPOINT
router.post('/register', async (req, res) => {
  const { name, email, phone, collegeId, department, aadhar, pan, roll_number, current_year } = req.body;
  
  try {
    if (!name || !email || !phone || !collegeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ error: 'Phone must be 10 digits' });
    }

    const connection = await pool.getConnection();
    const [existingEmail] = await connection.query(
      'SELECT id FROM students WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Email already registered' });
    }

    const referenceNo = 'SKC' + Date.now();

    const [result] = await connection.query(
      'INSERT INTO students (reference_no, name, email, phone, aadhar, pan, roll_number, current_year, college_id, department, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [referenceNo, name, email, phone, aadhar || null, pan || null, roll_number || null, current_year || 1, collegeId, department, 'registered']
    );

    connection.release();

    // SEND CONFIRMATION EMAIL
    try {
      // Use the centralized email function
      await sendWelcomeEmail(email, name, referenceNo);
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr);
      // We log the error but don't fail the whole registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      referenceNo: referenceNo,
      studentId: result.insertId,
      email: email
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

// GET ALL STUDENTS (ADMIN)
router.get('/', requireAdmin, async (req, res) => {
  const { district, collegeId, status, paymentStatus } = req.query;
  try {
    const connection = await pool.getConnection();
    
    let query = `
      SELECT s.*, c.name as college_name, d.name as district_name,
             (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = 'completed') as total_paid
      FROM students s 
      LEFT JOIN colleges c ON s.college_id = c.id 
      LEFT JOIN districts d ON c.district_id = d.id 
      WHERE 1=1
    `;
    const params = [];

    if (district) { query += ' AND d.id = ?'; params.push(district); }
    if (collegeId) { query += ' AND c.id = ?'; params.push(collegeId); }
    if (status) { query += ' AND s.status = ?'; params.push(status); }
    
    if (paymentStatus === 'paid') {
      query += ' AND (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") > 0';
    } else if (paymentStatus === 'unpaid') {
      query += ' AND ((SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") IS NULL OR (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") = 0)';
    }

    query += ' ORDER BY s.created_at DESC';

    const [students] = await connection.query(query, params);
    connection.release();

    res.json({
      success: true,
      count: students.length,
      students: students
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET FULL STUDENT PROFILE (Basic, Financial, Learning, Internship)
router.get('/:id/full-profile', requireAdmin, async (req, res) => {
  const studentId = req.params.id;
  try {
    const connection = await pool.getConnection();
    
    // Basic details
    const [[basic]] = await connection.query(`
      SELECT s.*, c.name as college_name, d.name as district_name 
      FROM students s LEFT JOIN colleges c ON s.college_id = c.id LEFT JOIN districts d ON c.district_id = d.id 
      WHERE s.id = ?`, [studentId]);
    
    if (!basic) {
      connection.release();
      return res.status(404).json({ error: 'Student not found' });
    }

    // Financials
    const [[financial]] = await connection.query(`SELECT SUM(amount) as total_paid FROM payments WHERE student_id = ? AND status = 'completed'`, [studentId]);
    const [payments] = await connection.query(`SELECT * FROM payments WHERE student_id = ? ORDER BY created_at DESC`, [studentId]);

    // Learning Path
    const [courses] = await connection.query(`SELECT sc.*, c.title FROM student_courses sc JOIN courses c ON sc.course_id = c.id WHERE sc.student_id = ?`, [studentId]);
    const [[attendance]] = await connection.query(`SELECT COUNT(*) as attended_classes FROM class_attendance WHERE student_id = ? AND status = 'present'`, [studentId]);
    const [assignments] = await connection.query(`SELECT * FROM assignment_submissions WHERE student_id = ?`, [studentId]);
    const [certificates] = await connection.query(`SELECT * FROM certificates WHERE student_id = ?`, [studentId]);

    // Internships
    const [internships] = await connection.query(`SELECT sp.*, p.title as program_title FROM student_programs sp JOIN programs p ON sp.program_id = p.id WHERE sp.student_id = ?`, [studentId]);

    connection.release();
    
    res.json({
      success: true,
      profile: {
        basic,
        financial: { wallet_balance: basic.wallet_balance, total_paid: financial.total_paid || 0, payments },
        learning: { courses, attended_classes: attendance.attended_classes, assignments, certificates },
        internships
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE STUDENT
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, email, phone, collegeId, department, status, roll_number, current_year, wallet_balance } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE students SET name=?, email=?, phone=?, college_id=?, department=?, status=?, roll_number=?, current_year=?, wallet_balance=? WHERE id=?',
      [name, email, phone, collegeId, department, status, roll_number, current_year, wallet_balance, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE STUDENT
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM students WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// VERIFY STUDENT
router.put('/:id/verify', requireAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE students SET status="verified" WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Student verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BULK VERIFY STUDENTS
router.post('/bulk-verify', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE students SET status="verified" WHERE id IN (?)', [ids]);
    connection.release();
    res.json({ success: true, message: 'Students verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BULK IMPORT STUDENTS (CSV/JSON Array)
router.post('/bulk-import', requireAdmin, async (req, res) => {
  const { students } = req.body; // Expects array of objects
  
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload. Expected an array of student objects.' });
  }

  try {
    const connection = await pool.getConnection();
    let imported = 0;
    let errors = [];

    for (const st of students) {
      const ref = 'SKC' + Date.now() + Math.floor(Math.random() * 1000);
      try {
        await connection.query(
          `INSERT INTO students (reference_no, name, email, phone, roll_number, current_year, college_id, department) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [ref, st.name, st.email, st.phone, st.roll_number || null, st.current_year || 1, st.college_id, st.department || null]
        );
        imported++;
      } catch (err) {
        errors.push({ email: st.email, error: err.message });
      }
    }
    connection.release();
    res.json({ success: true, message: `Successfully imported ${imported} students`, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;