const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Progress dashboard (master-dev-prompt Section I) -- per-student rollup of
// attendance %, assignment scores, and syllabus self-confirmation. The one
// clear gap the prompt calls out in an otherwise well-covered Academic
// Operations area; depends on Section G's topic_confirmations data existing.
// Mounted at /api/progress with requireAdmin in server.js.
router.get('/students/:id', async (req, res) => {
  const sid = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();

    const [[attendance]] = await connection.query(
      `SELECT COUNT(*) AS total, SUM(status = 'present') AS present
       FROM class_attendance WHERE student_id = ?`,
      [sid]
    );

    const [[assignments]] = await connection.query(
      `SELECT COUNT(*) AS graded, AVG(asub.marks / a.max_marks * 100) AS avg_pct
       FROM assignment_submissions asub
       JOIN assignments a ON a.id = asub.assignment_id
       WHERE asub.student_id = ? AND asub.marks IS NOT NULL AND a.max_marks > 0`,
      [sid]
    );

    const [confirmationRows] = await connection.query(
      `SELECT confirmation, COUNT(*) AS count FROM topic_confirmations WHERE student_id = ? GROUP BY confirmation`,
      [sid]
    );
    const syllabus = { got_it: 0, need_revision: 0, didnt_attend: 0 };
    confirmationRows.forEach((r) => { syllabus[r.confirmation] = r.count; });
    const syllabusTotal = syllabus.got_it + syllabus.need_revision + syllabus.didnt_attend;

    res.json({
      success: true,
      attendance: {
        total: attendance.total || 0,
        present: Number(attendance.present) || 0,
        pct: attendance.total ? Math.round((Number(attendance.present) || 0) / attendance.total * 100) : null,
      },
      assignments: {
        graded: assignments.graded || 0,
        avgPct: assignments.avg_pct != null ? Math.round(assignments.avg_pct) : null,
      },
      syllabus: { ...syllabus, total: syllabusTotal },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
