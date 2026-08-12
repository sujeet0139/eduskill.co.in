const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireStudent } = require('../middleware/studentAuth');
const { makeUpload, fileUrl } = require('../config/storage');

// Assignment submission uploads (PDF/image/doc, 10 MB).
const submissionUpload = makeUpload({
  folder: 'eduskill/submissions',
  prefix: 'submission-',
  maxSize: 10 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|pdf|doc|docx/,
  allowedMime: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
});

// GET /api/student-dashboard/profile - Fetch student profile
router.get('/profile', requireStudent, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [students] = await connection.query(
      'SELECT id, reference_no, name, email, phone, college_id, department, status, created_at FROM students WHERE id = ?',
      [req.user.id]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, profile: students[0] });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/student-dashboard/certificates - Fetch student certificates
router.get('/certificates', requireStudent, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [certificates] = await connection.query(
      'SELECT * FROM certificates WHERE student_id = ? AND status = "active"',
      [req.user.id]
    );

    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/student-dashboard/assignments - assignments visible to this student,
// resolved from targeting (all / their courses / programs / batches / selected),
// with their own submission (if any) joined in.
router.get('/assignments', requireStudent, async (req, res) => {
  const sid = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [assignments] = await connection.query(`
      SELECT DISTINCT a.id, a.title, a.description, a.due_date, a.max_marks, a.submission_type, a.audience,
        c.title AS course_title, p.title AS program_title,
        sub.id AS submission_id, sub.file_url, sub.text_answer, sub.marks, sub.feedback, sub.status AS submission_status, sub.submitted_at
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN programs p ON a.program_id = p.id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
      WHERE
        a.audience = 'all'
        OR (a.audience = 'course'   AND a.course_id  IN (SELECT course_id  FROM student_courses  WHERE student_id = ?))
        OR (a.audience = 'program'  AND a.program_id IN (SELECT program_id FROM student_programs WHERE student_id = ?))
        OR (a.audience = 'batch'    AND (
              a.batch_id IN (SELECT batch_id FROM student_courses  WHERE student_id = ? AND batch_id IS NOT NULL)
           OR a.batch_id IN (SELECT batch_id FROM student_programs WHERE student_id = ? AND batch_id IS NOT NULL)))
        OR (a.audience = 'selected' AND a.id IN (SELECT assignment_id FROM assignment_targets WHERE student_id = ?))
      ORDER BY a.due_date IS NULL, a.due_date ASC, a.created_at DESC
    `, [sid, sid, sid, sid, sid, sid]);
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/student-dashboard/assignments/:id/submit - submit or re-submit.
router.post('/assignments/:id/submit', requireStudent, submissionUpload.single('file'), async (req, res) => {
  const sid = req.user.id;
  const assignmentId = req.params.id;
  const { text_answer } = req.body;
  const url = fileUrl(req.file);
  if (!url && !text_answer) {
    return res.status(400).json({ error: 'Attach a file or write an answer.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    // Confirm the assignment exists (light guard).
    const [[assignment]] = await connection.query('SELECT id FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) { return res.status(404).json({ error: 'Assignment not found.' }); }

    await connection.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, file_url, text_answer, status, submitted_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())
       ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), text_answer = VALUES(text_answer), status = 'pending', submitted_at = NOW()`,
      [assignmentId, sid, url || null, text_answer || null]
    );
    res.json({ success: true, message: 'Submission received.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/student-dashboard/materials - materials for THIS student: those tagged
// to their enrolled courses/programs, plus general (untagged) materials.
router.get('/materials', requireStudent, async (req, res) => {
  const sid = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [materials] = await connection.query(`
      SELECT m.*, c.title AS course_title, p.title AS program_title
      FROM study_materials m
      LEFT JOIN courses c ON m.course_id = c.id
      LEFT JOIN programs p ON m.program_id = p.id
      WHERE m.is_active = TRUE AND (
        (m.course_id IS NULL AND m.program_id IS NULL)
        OR m.course_id  IN (SELECT course_id  FROM student_courses  WHERE student_id = ?)
        OR m.program_id IN (SELECT program_id FROM student_programs WHERE student_id = ?)
      )
      ORDER BY m.subject IS NULL, m.subject ASC, m.created_at DESC
    `, [sid, sid]);
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/student-dashboard/live-classes - upcoming/recent classes for this student
// (targeted to their college / enrolled course, or open to all).
router.get('/live-classes', requireStudent, async (req, res) => {
  const sid = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [[me]] = await connection.query('SELECT college_id FROM students WHERE id = ?', [sid]);
    const collegeId = me ? me.college_id : null;
    const [classes] = await connection.query(`
      SELECT lc.id, lc.title, lc.topic, lc.scheduled_at, lc.duration_minutes, lc.meet_link,
             lc.recording_url, lc.materials_url, lc.status, f.name AS mentor_name, c.title AS course_title
      FROM live_classes lc
      LEFT JOIN faculty f ON lc.mentor_id = f.id
      LEFT JOIN courses c ON lc.course_id = c.id
      WHERE (lc.college_id IS NULL OR lc.college_id = ?)
        AND (lc.course_id IS NULL OR lc.course_id IN (SELECT course_id FROM student_courses WHERE student_id = ?))
      ORDER BY lc.scheduled_at DESC
      LIMIT 30
    `, [collegeId, sid]);
    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;