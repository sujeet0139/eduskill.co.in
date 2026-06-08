const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// STUDENT LOGIN ENDPOINT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const connection = await pool.getConnection();
    
    // For students, we use their Reference Number (SKC...) as their password
    const [students] = await connection.query(
      'SELECT * FROM students WHERE email = ? AND reference_no = ?',
      [email, password]
    );
    connection.release();

    if (students.length === 0) {
      return res.status(401).json({ error: 'Invalid Email or Reference Number' });
    }

    const student = students[0];
    
    // Generate a secure session token
    const token = jwt.sign(
      { id: student.id, email: student.email, role: 'student' },
      process.env.JWT_SECRET || 'your_secret_key_here_12345',
      { expiresIn: '24h' }
    );

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
    
    const token = jwt.sign(
      { id: admin.id, role: admin.role, email: admin.email },
      process.env.JWT_SECRET || 'your_secret_key_here_12345',
      { expiresIn: '24h' }
    );
    
    return res.json({ success: true, token, admin: { email: admin.email, role: admin.role, name: admin.name } });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error during admin login' });
  }
});

module.exports = router;