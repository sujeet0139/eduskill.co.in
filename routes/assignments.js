const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL ASSIGNMENTS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [assignments] = await connection.query(`
      SELECT a.*, c.title as course_title,
      (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as total_submissions
      FROM assignments a 
      LEFT JOIN courses c ON a.course_id = c.id 
      ORDER BY a.created_at DESC
    `);
    connection.release();
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW ASSIGNMENT
router.post('/', async (req, res) => {
  const { title, course_id, description, due_date, max_marks, submission_type } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO assignments (title, course_id, description, due_date, max_marks, submission_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, course_id || null, description, due_date, max_marks, submission_type]
    );
    connection.release();
    res.json({ success: true, message: 'Assignment created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET SUBMISSIONS FOR A SPECIFIC ASSIGNMENT
router.get('/:id/submissions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [submissions] = await connection.query(`
      SELECT sub.*, s.name as student_name, c.name as college_name 
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
      [marks, feedback, status, req.params.id, req.params.studentId]
    );
    connection.release();
    res.json({ success: true, message: 'Submission graded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;