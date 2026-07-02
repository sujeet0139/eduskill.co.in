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
        c.template_id, c.course_id, c.program_id,
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

    if (!certificate) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Certificate not found or invalid.' });
    }

    // Attach the design template: the one stamped at issue time, else the default.
    // Resilient to the templates table not existing yet (pre-migration).
    let template = null;
    try {
      if (certificate.template_id) {
        const [[t]] = await connection.query('SELECT * FROM certificate_templates WHERE id = ?', [certificate.template_id]);
        template = t || null;
      }
      if (!template) {
        const [[def]] = await connection.query('SELECT * FROM certificate_templates WHERE is_default = 1 ORDER BY id LIMIT 1');
        template = def || null;
      }
    } catch (e) { template = null; }
    connection.release();

    res.json({ success: true, certificate, template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;