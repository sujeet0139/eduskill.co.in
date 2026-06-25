const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL CERTIFICATES
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [certificates] = await connection.query(`
      SELECT c.*, s.name as student_name, s.reference_no, 
             co.title as course_title, p.title as program_title
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      LEFT JOIN courses co ON c.course_id = co.id
      LEFT JOIN programs p ON c.program_id = p.id
      ORDER BY c.issued_date DESC
    `);
    connection.release();
    res.json({ success: true, certificates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CHECK ELIGIBILITY AND AUTO-GENERATE CERTIFICATE
router.post('/check-and-generate', async (req, res) => {
  const { student_id, program_id, course_id } = req.body;
  const ATTENDANCE_THRESHOLD = 80.0;
  const PASSING_THRESHOLD = 50.0;

  if (!student_id || (!program_id && !course_id)) {
    return res.status(400).json({ error: 'student_id and either program_id or course_id are required.' });
  }

  try {
    const connection = await pool.getConnection();

    // 1. Check Attendance (Simplified)
    const [[total_classes]] = await connection.query(`SELECT COUNT(*) as count FROM live_classes WHERE program_id = ? OR course_id = ?`, [program_id || null, course_id || null]);
    const [[attended_classes]] = await connection.query(`SELECT COUNT(*) as count FROM class_attendance ca JOIN live_classes lc ON ca.class_id = lc.id WHERE ca.student_id = ? AND ca.status = 'present' AND (lc.program_id = ? OR lc.course_id = ?)`, [student_id, program_id || null, course_id || null]);
    const attendance_percent = total_classes.count > 0 ? (attended_classes.count / total_classes.count) * 100 : 0;

    if (attendance_percent < ATTENDANCE_THRESHOLD) {
      connection.release();
      return res.status(400).json({ success: false, message: `Student not eligible. Attendance is ${attendance_percent.toFixed(2)}%, requires ${ATTENDANCE_THRESHOLD}%.` });
    }

    // 2. Check Exam Score (Weighted Average)
    const [attempts] = await connection.query(`SELECT sa.percentage, e.weightage_percent, e.type FROM student_exam_attempts sa JOIN exams e ON sa.exam_id = e.id WHERE sa.student_id = ? AND (e.program_id = ? OR e.course_id = ?) AND sa.status = 'graded'`, [student_id, program_id || null, course_id || null]);

    let final_score = 0;
    let total_weight = 0;
    attempts.forEach(attempt => {
      if (attempt.type === 'mid_term' || attempt.type === 'final_exam') {
        final_score += (attempt.percentage * (attempt.weightage_percent / 100));
        total_weight += attempt.weightage_percent;
      }
    });

    if (total_weight > 0 && total_weight !== 100) {
        final_score = (final_score / total_weight) * 100;
    }

    if (final_score < PASSING_THRESHOLD) {
      connection.release();
      return res.status(400).json({ success: false, message: `Student not eligible. Final score is ${final_score.toFixed(2)}%, requires ${PASSING_THRESHOLD}%.` });
    }

    // 3. Generate Certificate
    const certificate_no = 'CERT-' + Date.now();
    await connection.query(
      `INSERT INTO certificates (student_id, course_id, program_id, certificate_no, issued_date, final_score_percent) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE certificate_no = VALUES(certificate_no), issued_date = VALUES(issued_date), final_score_percent = VALUES(final_score_percent)`,
      [student_id, course_id || null, program_id || null, certificate_no, new Date(), final_score]
    );

    connection.release();
    res.json({ success: true, message: 'Student is eligible. Certificate generated successfully.', certificate_no });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// MANUAL GENERATE CERTIFICATE (Admin Override)
router.post('/generate', async (req, res) => {
  const { student_id, course_id, program_id, issued_date } = req.body;
  try {
    const certificate_no = 'CERT-' + Date.now();
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO certificates (student_id, course_id, program_id, certificate_no, issued_date) 
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, course_id || null, program_id || null, certificate_no, issued_date || new Date()]
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