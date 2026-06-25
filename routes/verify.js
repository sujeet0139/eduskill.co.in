const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// VERIFY CERTIFICATE VIA QR CODE/NUMBER
router.get('/certificate/:certNo', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [[certificate]] = await connection.query(`
      SELECT 
        c.certificate_no, c.issued_date, c.status, c.final_score_percent,
        s.name as student_name, s.reference_no,
        clg.name as college_name,
        crs.title as course_title,
        prg.title as program_title
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      LEFT JOIN colleges clg ON s.college_id = clg.id
      LEFT JOIN courses crs ON c.course_id = crs.id
      LEFT JOIN programs prg ON c.program_id = prg.id
      WHERE c.certificate_no = ?
    `, [req.params.certNo]);
    
    connection.release();

    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found or invalid.' });
    }

    res.json({ success: true, certificate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;