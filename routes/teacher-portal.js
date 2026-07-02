const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireTeacher } = require('../middleware/teacherAuth');

// All routes here require a logged-in teacher.
router.use(requireTeacher);

// Dropdown/selection data for composing an assignment.
router.get('/meta', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [courses] = await connection.query('SELECT id, title FROM courses ORDER BY title');
    const [programs] = await connection.query('SELECT id, title FROM programs ORDER BY title');
    const [batches] = await connection.query('SELECT id, name, course_id, program_id FROM batches ORDER BY name');
    const [students] = await connection.query('SELECT id, name, reference_no FROM students ORDER BY name');
    connection.release();
    res.json({ success: true, courses, programs, batches, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assignments THIS teacher created.
router.get('/assignments', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [assignments] = await connection.query(`
      SELECT a.*, c.title AS course_title, p.title AS program_title, b.name AS batch_name,
        (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) AS total_submissions,
        (SELECT COUNT(*) FROM assignment_targets WHERE assignment_id = a.id) AS target_count
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN programs p ON a.program_id = p.id
      LEFT JOIN batches b ON a.batch_id = b.id
      WHERE a.created_by = ? AND a.created_by_role = 'teacher'
      ORDER BY a.created_at DESC
    `, [req.teacher.email]);
    connection.release();
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create & share an assignment (same targeting model as the admin route).
router.post('/assignments', async (req, res) => {
  const { title, description, due_date, max_marks, submission_type,
          audience = 'all', course_id, program_id, batch_id, student_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      `INSERT INTO assignments (title, course_id, program_id, batch_id, audience, description, due_date, max_marks, submission_type, created_by, created_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'teacher')`,
      [title, course_id || null, program_id || null, batch_id || null, audience,
       description || null, due_date || null, max_marks || null, submission_type || 'both', req.teacher.email]
    );
    const assignmentId = result.insertId;
    if (audience === 'selected' && Array.isArray(student_ids) && student_ids.length) {
      const values = student_ids.map(() => '(?, ?)').join(',');
      const params = student_ids.flatMap((sid) => [assignmentId, sid]);
      await connection.query(`INSERT INTO assignment_targets (assignment_id, student_id) VALUES ${values}`, params);
    }
    connection.release();
    res.json({ success: true, message: 'Assignment created and shared.', id: assignmentId });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: error.message });
  }
});

// Guard: confirm this assignment belongs to the requesting teacher.
async function ownsAssignment(connection, assignmentId, email) {
  const [[a]] = await connection.query(
    "SELECT id FROM assignments WHERE id = ? AND created_by = ? AND created_by_role = 'teacher'",
    [assignmentId, email]);
  return !!a;
}

// Submissions for one of the teacher's assignments.
router.get('/assignments/:id/submissions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    if (!(await ownsAssignment(connection, req.params.id, req.teacher.email))) {
      connection.release();
      return res.status(403).json({ error: 'Not your assignment.' });
    }
    const [submissions] = await connection.query(`
      SELECT sub.*, s.name AS student_name, s.reference_no
      FROM assignment_submissions sub JOIN students s ON sub.student_id = s.id
      WHERE sub.assignment_id = ? ORDER BY sub.submitted_at DESC
    `, [req.params.id]);
    connection.release();
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Grade a submission for one of the teacher's assignments.
router.put('/assignments/:id/submissions/:studentId/grade', async (req, res) => {
  const { marks, feedback, status } = req.body;
  try {
    const connection = await pool.getConnection();
    if (!(await ownsAssignment(connection, req.params.id, req.teacher.email))) {
      connection.release();
      return res.status(403).json({ error: 'Not your assignment.' });
    }
    await connection.query(
      'UPDATE assignment_submissions SET marks=?, feedback=?, status=? WHERE assignment_id=? AND student_id=?',
      [marks ?? null, feedback || null, status || 'approved', req.params.id, req.params.studentId]);
    connection.release();
    res.json({ success: true, message: 'Graded.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
