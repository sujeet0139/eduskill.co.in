const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL CERTIFICATES
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [certificates] = await connection.query(`
      SELECT c.*, s.name as student_name, s.reference_no, co.title as course_title
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      LEFT JOIN courses co ON c.course_id = co.id
      ORDER BY c.issued_date DESC
    `);
    connection.release();
    res.json({ success: true, certificates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GENERATE CERTIFICATE
router.post('/generate', async (req, res) => {
  const { student_id, course_id, issued_date } = req.body;
  try {
    const certificate_no = 'CERT-' + Date.now();
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO certificates (student_id, course_id, certificate_no, issued_date) 
       VALUES (?, ?, ?, ?)`,
      [student_id, course_id || null, certificate_no, issued_date || new Date()]
    );
    connection.release();
    res.json({ success: true, message: 'Certificate generated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REVOKE CERTIFICATE
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE certificates SET status = "revoked" WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Certificate revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;