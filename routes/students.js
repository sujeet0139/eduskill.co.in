const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const nodemailer = require('nodemailer');

// STUDENT REGISTRATION ENDPOINT
router.post('/register', async (req, res) => {
  const { name, email, phone, collegeId, department, aadhar, pan } = req.body;
  
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
      'INSERT INTO students (reference_no, name, email, phone, aadhar, pan, college_id, department, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [referenceNo, name, email, phone, aadhar || null, pan || null, collegeId, department, 'registered']
    );

    connection.release();

    // SEND CONFIRMATION EMAIL
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
        port: process.env.SMTP_PORT || 465,
        secure: true, // Use SSL (true for port 465)
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Registration Successful - eduskill.co.in',
        html: `
          <h2>Welcome to eduskill.co.in!</h2>
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your student registration was successful.</p>
          <p><strong>Your Reference Number:</strong> <span style="color: blue;">${referenceNo}</span></p>
          <p>Please keep this reference number safe for your records and future updates.</p>
          <br/>
          <p>Best Regards,<br/>Eduskill Team</p>
        `
      });
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
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [students] = await connection.query(
      `SELECT s.*, c.name as college_name FROM students s 
       LEFT JOIN colleges c ON s.college_id = c.id 
       ORDER BY s.created_at DESC`
    );
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

// UPDATE STUDENT
router.put('/:id', async (req, res) => {
  const { name, email, phone, collegeId, department, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE students SET name=?, email=?, phone=?, college_id=?, department=?, status=? WHERE id=?',
      [name, email, phone, collegeId, department, status, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE STUDENT
router.delete('/:id', async (req, res) => {
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
router.put('/:id/verify', async (req, res) => {
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
router.post('/bulk-verify', async (req, res) => {
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

module.exports = router;