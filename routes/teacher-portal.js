const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { requireTeacher } = require('../middleware/teacherAuth');
const { makeUpload, fileUrl } = require('../config/storage');

// All routes here require a logged-in teacher.
router.use(requireTeacher);

const photoUpload = makeUpload({
  folder: 'eduskill/teacher-photos',
  prefix: 'teacher-',
  maxSize: 2 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp/,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
});
const materialUpload = makeUpload({
  folder: 'eduskill/materials',
  prefix: 'material-',
  maxSize: 10 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|pdf|doc|docx/,
  allowedMime: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
});

// Guard: confirm a batch is actually assigned to this teacher (item #27 --
// a teacher must only ever touch their own batches). Returns the batch row
// (with course_id/program_id) or null.
async function ownsBatch(connection, batchId, teacherId) {
  const [[batch]] = await connection.query('SELECT * FROM batches WHERE id = ? AND teacher_id = ?', [batchId, teacherId]);
  return batch || null;
}

// ---- PROFILE (item #27) ----
router.get('/profile', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[teacher]] = await connection.query(
      'SELECT id, teacher_id, name, subject, expertise, bio, qualification, experience, mobile, email, gender, dob, profile_photo, available_time, class_timing, status FROM teachers WHERE id = ?',
      [req.teacher.id]
    );
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Self-editable subset -- name/email/status stay admin-controlled.
router.put('/profile', async (req, res) => {
  const { subject, expertise, bio, qualification, experience, mobile, available_time, class_timing } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE teachers SET subject=?, expertise=?, bio=?, qualification=?, experience=?, mobile=?, available_time=?, class_timing=? WHERE id=?`,
      [subject || null, expertise || null, bio || null, qualification || null, experience || null, mobile || null, available_time || null, class_timing || null, req.teacher.id]
    );
    res.json({ success: true, message: 'Profile updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/profile/photo', photoUpload.single('photo'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'Photo file is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE teachers SET profile_photo = ? WHERE id = ?', [url, req.teacher.id]);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/profile/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await connection.query('UPDATE teachers SET password_hash = ? WHERE id = ?', [hash, req.teacher.id]);
    res.json({ success: true, message: 'Password updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- MY BATCHES (item #27 -- "view of only their assigned batches") ----
router.get('/my-batches', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [batches] = await connection.query(`
      SELECT b.*, c.title AS course_title, p.title AS program_title
      FROM batches b
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN programs p ON b.program_id = p.id
      WHERE b.teacher_id = ?
      ORDER BY b.start_date DESC
    `, [req.teacher.id]);
    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/batches/:batchId/students', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const batch = await ownsBatch(connection, req.params.batchId, req.teacher.id);
    if (!batch) return res.status(403).json({ error: 'Not your batch.' });

    const table = batch.course_id ? 'student_courses' : 'student_programs';
    const [students] = await connection.query(`
      SELECT s.id, s.name, s.reference_no, s.email, s.phone
      FROM ${table} sc JOIN students s ON s.id = sc.student_id
      WHERE sc.batch_id = ? ORDER BY s.name
    `, [req.params.batchId]);
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- ATTENDANCE (item #27 -- "attendance marking per batch/session") ----
router.get('/batches/:batchId/sessions', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const batch = await ownsBatch(connection, req.params.batchId, req.teacher.id);
    if (!batch) return res.status(403).json({ error: 'Not your batch.' });
    const [sessions] = await connection.query(
      'SELECT * FROM live_classes WHERE batch_id = ? ORDER BY scheduled_at DESC', [req.params.batchId]
    );
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/batches/:batchId/sessions', async (req, res) => {
  const { title, topic, scheduled_at, duration_minutes } = req.body;
  if (!title || !scheduled_at) return res.status(400).json({ error: 'title and scheduled_at are required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const batch = await ownsBatch(connection, req.params.batchId, req.teacher.id);
    if (!batch) return res.status(403).json({ error: 'Not your batch.' });
    const [result] = await connection.query(
      `INSERT INTO live_classes (title, topic, batch_id, course_id, scheduled_at, duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, topic || null, req.params.batchId, batch.course_id || null, scheduled_at, duration_minutes || 60]
    );
    res.status(201).json({ success: true, message: 'Session created.', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Guard: confirm a session's batch belongs to this teacher. Returns the
// session row (with batch_id) or null.
async function ownsSession(connection, sessionId, teacherId) {
  const [[session]] = await connection.query(
    `SELECT lc.* FROM live_classes lc JOIN batches b ON b.id = lc.batch_id WHERE lc.id = ? AND b.teacher_id = ?`,
    [sessionId, teacherId]
  );
  return session || null;
}

router.get('/sessions/:sessionId/attendance', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const session = await ownsSession(connection, req.params.sessionId, req.teacher.id);
    if (!session) return res.status(403).json({ error: 'Not your session.' });
    const [rows] = await connection.query(
      `SELECT sc.student_id, s.name, s.reference_no, ca.status
       FROM student_courses sc
       JOIN students s ON s.id = sc.student_id
       LEFT JOIN class_attendance ca ON ca.class_id = ? AND ca.student_id = sc.student_id
       WHERE sc.batch_id = ?
       ORDER BY s.name`,
      [req.params.sessionId, session.batch_id]
    );
    res.json({ success: true, attendance: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Body: { records: [{ student_id, status: 'present'|'absent' }, ...] }
router.post('/sessions/:sessionId/attendance', async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'records (non-empty array) is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const session = await ownsSession(connection, req.params.sessionId, req.teacher.id);
    if (!session) return res.status(403).json({ error: 'Not your session.' });
    for (const r of records) {
      if (!['present', 'absent'].includes(r.status)) continue;
      await connection.query(
        `INSERT INTO class_attendance (class_id, student_id, status) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [req.params.sessionId, r.student_id, r.status]
      );
    }
    res.json({ success: true, message: 'Attendance saved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- MATERIALS (item #27 -- "material upload, visible only to that
// batch's enrolled students") -- tagged to the batch's course/program,
// which is exactly how routes/student-dashboard.js already scopes
// visibility to enrolled students. ----
router.get('/batches/:batchId/materials', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const batch = await ownsBatch(connection, req.params.batchId, req.teacher.id);
    if (!batch) return res.status(403).json({ error: 'Not your batch.' });
    const [materials] = await connection.query(
      'SELECT * FROM study_materials WHERE (course_id = ? OR program_id = ?) AND is_active = TRUE ORDER BY created_at DESC',
      [batch.course_id || null, batch.program_id || null]
    );
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/batches/:batchId/materials', materialUpload.single('document'), async (req, res) => {
  const { title, description } = req.body;
  const filePath = fileUrl(req.file);
  if (!title || !filePath) return res.status(400).json({ error: 'Title and document are required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const batch = await ownsBatch(connection, req.params.batchId, req.teacher.id);
    if (!batch) return res.status(403).json({ error: 'Not your batch.' });
    await connection.query(
      'INSERT INTO study_materials (title, description, course_id, program_id, file_path) VALUES (?, ?, ?, ?, ?)',
      [title, description || null, batch.course_id || null, batch.program_id || null, filePath]
    );
    res.status(201).json({ success: true, message: 'Material uploaded.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Dropdown/selection data for composing an assignment.
router.get('/meta', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [courses] = await connection.query('SELECT id, title FROM courses ORDER BY title');
    const [programs] = await connection.query('SELECT id, title FROM programs ORDER BY title');
    const [batches] = await connection.query('SELECT id, name, course_id, program_id FROM batches ORDER BY name');
    const [students] = await connection.query('SELECT id, name, reference_no FROM students ORDER BY name');
    res.json({ success: true, courses, programs, batches, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Assignments THIS teacher created.
router.get('/assignments', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
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
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
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
    res.json({ success: true, message: 'Assignment created and shared.', id: assignmentId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
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
  let connection;
  try {
    connection = await pool.getConnection();
    if (!(await ownsAssignment(connection, req.params.id, req.teacher.email))) {
      return res.status(403).json({ error: 'Not your assignment.' });
    }
    const [submissions] = await connection.query(`
      SELECT sub.*, s.name AS student_name, s.reference_no
      FROM assignment_submissions sub JOIN students s ON sub.student_id = s.id
      WHERE sub.assignment_id = ? ORDER BY sub.submitted_at DESC
    `, [req.params.id]);
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Grade a submission for one of the teacher's assignments.
router.put('/assignments/:id/submissions/:studentId/grade', async (req, res) => {
  const { marks, feedback, status } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    if (!(await ownsAssignment(connection, req.params.id, req.teacher.email))) {
      return res.status(403).json({ error: 'Not your assignment.' });
    }
    await connection.query(
      'UPDATE assignment_submissions SET marks=?, feedback=?, status=? WHERE assignment_id=? AND student_id=?',
      [marks ?? null, feedback || null, status || 'approved', req.params.id, req.params.studentId]);
    res.json({ success: true, message: 'Graded.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
