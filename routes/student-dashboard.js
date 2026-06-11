const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireStudent } = require('../middleware/studentAuth');

// GET /api/student-dashboard/profile - Fetch student profile
router.get('/profile', requireStudent, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [students] = await connection.query(
      'SELECT id, reference_no, name, email, phone, college_id, department, status, created_at FROM students WHERE id = ?',
      [req.user.id]
    );
    connection.release();

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, profile: students[0] });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/student-dashboard/certificates - Fetch student certificates
router.get('/certificates', requireStudent, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [certificates] = await connection.query(
      'SELECT * FROM certificates WHERE student_id = ? AND status = "active"',
      [req.user.id]
    );
    connection.release();

    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;