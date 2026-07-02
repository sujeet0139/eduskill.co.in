const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL ASSIGNMENTS (admin) — with course/program titles + submission count.
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [assignments] = await connection.query(`
      SELECT a.*, c.title as course_title, p.title as program_title, b.name as batch_name,
        (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as total_submissions,
        (SELECT COUNT(*) FROM assignment_targets WHERE assignment_id = a.id) as target_count
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN programs p ON a.program_id = p.id
      LEFT JOIN batches b ON a.batch_id = b.id
      ORDER BY a.created_at DESC
    `);
    connection.release();
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW ASSIGNMENT with targeting.
// audience: 'all' | 'course' | 'program' | 'batch' | 'selected'
// For 'selected' (incl. a single student), pass student_ids: [..].
router.post('/', async (req, res) => {
  const { title, description, due_date, max_marks, submission_type,
          audience = 'all', course_id, program_id, batch_id, student_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO assignments (title, course_id, program_id, batch_id, audience, description, due_date, max_marks, submission_type, created_by, created_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, course_id || null, program_id || null, batch_id || null, audience,
       description || null, due_date || null, max_marks || null, submission_type || 'both',
       req.admin?.email || req.teacher?.email || null, req.admin ? 'admin' : (req.teacher ? 'teacher' : null)]
    );
    const assignmentId = result.insertId;

    if (audience === 'selected' && Array.isArray(student_ids) && student_ids.length) {
      const values = student_ids.map(() => '(?, ?)').join(',');
      const params = student_ids.flatMap((sid) => [assignmentId, sid]);
      await connection.query(`INSERT INTO assignment_targets (assignment_id, student_id) VALUES ${values}`, params);
    }
    connection.release();
    res.json({ success: true, message: 'Assignment created and shared successfully', id: assignmentId });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: error.message });
  }
});

// DELETE AN ASSIGNMENT (cascades to submissions + targets).
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Assignment deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET SUBMISSIONS FOR A SPECIFIC ASSIGNMENT
router.get('/:id/submissions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [submissions] = await connection.query(`
      SELECT sub.*, s.name as student_name, s.reference_no, c.name as college_name
      FROM assignment_submissions sub
      JOIN students s ON sub.student_id = s.id
      LEFT JOIN colleges c ON s.college_id = c.id
      WHERE sub.assignment_id = ?
      ORDER BY sub.submitted_at DESC
    `, [req.params.id]);
    connection.release();
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GRADE A SUBMISSION
router.put('/:id/submissions/:studentId/grade', async (req, res) => {
  const { marks, feedback, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE assignment_submissions
       SET marks=?, feedback=?, status=?
       WHERE assignment_id=? AND student_id=?`,
      [marks ?? null, feedback || null, status || 'approved', req.params.id, req.params.studentId]
    );
    connection.release();
    res.json({ success: true, message: 'Submission graded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
