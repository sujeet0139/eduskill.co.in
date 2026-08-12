const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendClassMaterialsEmail, sendClassReminderEmail } = require('../email');
const { makeUpload, fileUrl } = require('../config/storage');

// Configure upload for class materials and recordings (up to 50MB)
const upload = makeUpload({
  folder: 'eduskill/classes',
  prefix: 'class-',
  maxSize: 50 * 1024 * 1024, 
  allowedExt: /jpeg|jpg|png|pdf|doc|docx|mp4|mkv/,
  allowedMime: [
    'image/jpeg', 'image/png', 'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4', 'video/x-matroska'
  ]
});

// ==========================================
// 1. GET ALL CLASSES (With optional filters)
// ==========================================
router.get('/', async (req, res) => {
  const { status, mentor_id, college_id, startDate, endDate } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT lc.*, f.name as mentor_name, c.name as target_college, co.title as target_course,
             (SELECT COUNT(*) FROM class_attendance WHERE class_id = lc.id AND status = 'present') as present_count
      FROM live_classes lc
      LEFT JOIN faculty f ON lc.mentor_id = f.id
      LEFT JOIN colleges c ON lc.college_id = c.id
      LEFT JOIN courses co ON lc.course_id = co.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) { query += ' AND lc.status = ?'; params.push(status); }
    if (mentor_id) { query += ' AND lc.mentor_id = ?'; params.push(mentor_id); }
    if (college_id) { query += ' AND lc.college_id = ?'; params.push(college_id); }
    if (startDate) { query += ' AND lc.scheduled_at >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND lc.scheduled_at <= ?'; params.push(endDate); }

    query += ' ORDER BY lc.scheduled_at DESC';

    const [classes] = await connection.query(query, params);

    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 2. CREATE NEW LIVE CLASS
// ==========================================
router.post('/', async (req, res) => {
  const { title, topic, mentor_id, course_id, college_id, scheduled_at, duration_minutes, meet_link, max_students, attendance_enabled } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO live_classes (title, topic, mentor_id, course_id, college_id, scheduled_at, duration_minutes, meet_link, max_students, attendance_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, topic, mentor_id || null, course_id || null, college_id || null, scheduled_at, duration_minutes || 60, meet_link, max_students || 100, attendance_enabled !== undefined ? attendance_enabled : true]
    );
    res.json({ success: true, message: 'Live class scheduled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 3. UPDATE CLASS
// ==========================================
router.put('/:id', async (req, res) => {
  const { title, topic, mentor_id, scheduled_at, duration_minutes, meet_link, status } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE live_classes SET title=?, topic=?, mentor_id=?, scheduled_at=?, duration_minutes=?, meet_link=?, status=? WHERE id=?`,
      [title, topic, mentor_id || null, scheduled_at, duration_minutes, meet_link, status, req.params.id]
    );
    res.json({ success: true, message: 'Class details updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 4. ATTENDANCE REPORT (Student %)
// ==========================================
router.get('/attendance-report', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [report] = await connection.query(`
      SELECT s.id, s.name, s.reference_no, c.name as college_name,
             COUNT(ca.id) as total_classes_marked,
             SUM(CASE WHEN ca.status = 'present' THEN 1 ELSE 0 END) as total_present,
             ROUND((SUM(CASE WHEN ca.status = 'present' THEN 1 ELSE 0 END) / COUNT(ca.id)) * 100, 2) as attendance_percentage
      FROM students s
      JOIN class_attendance ca ON s.id = ca.student_id
      LEFT JOIN colleges c ON s.college_id = c.id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 5. GET ATTENDANCE FOR SPECIFIC CLASS
// ==========================================
router.get('/:id/attendance', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [records] = await connection.query(`
      SELECT ca.*, s.name, s.reference_no, s.email, c.name as college_name
      FROM class_attendance ca
      JOIN students s ON ca.student_id = s.id
      LEFT JOIN colleges c ON s.college_id = c.id
      WHERE ca.class_id = ?
      ORDER BY s.name ASC
    `, [req.params.id]);
    res.json({ success: true, attendance: records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 6. MARK CLASS ATTENDANCE (Bulk Insert/Update)
// ==========================================
router.post('/:id/attendance', async (req, res) => {
  const classId = req.params.id;
  // Expected body: { attendance: [{ student_id: 1, status: 'present' }, { student_id: 2, status: 'absent' }] }
  const { attendance } = req.body;
  let connection;
  try {
    if (!attendance || !Array.isArray(attendance)) return res.status(400).json({ error: 'Invalid attendance format' });

    connection = await pool.getConnection();
    for (const record of attendance) {
      await connection.query(
        `INSERT INTO class_attendance (class_id, student_id, status) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = ?`,
        [classId, record.student_id, record.status, record.status]
      );
    }
    res.json({ success: true, message: 'Attendance marked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 7. UPLOAD RECORDING & MATERIALS
// ==========================================
router.post('/:id/upload', upload.fields([{ name: 'recording', maxCount: 1 }, { name: 'materials', maxCount: 1 }]), async (req, res) => {
  let connection;
  try {
    const updates = [];
    const params = [];

    // Accommodate direct file uploads or simple URL strings
    if (req.files && req.files['recording']) { updates.push('recording_url = ?'); params.push(fileUrl(req.files['recording'][0])); }
    else if (req.body.recording_url) { updates.push('recording_url = ?'); params.push(req.body.recording_url); }

    if (req.files && req.files['materials']) { updates.push('materials_url = ?'); params.push(fileUrl(req.files['materials'][0])); }
    else if (req.body.materials_url) { updates.push('materials_url = ?'); params.push(req.body.materials_url); }

    if (updates.length > 0) {
      connection = await pool.getConnection();
      params.push(req.params.id);
      await connection.query(`UPDATE live_classes SET ${updates.join(', ')} WHERE id = ?`, params);
      res.json({ success: true, message: 'Class materials uploaded successfully' });
    } else {
      res.status(400).json({ error: 'No files or URLs provided' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 8. SEND NOTIFICATION FOR MATERIALS/RECORDING
// ==========================================
router.post('/:id/notify-materials', async (req, res) => {
  const classId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();

    // Get class details
    const [[classDetails]] = await connection.query('SELECT * FROM live_classes WHERE id = ?', [classId]);
    if (!classDetails) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get target students
    let studentQuery = `SELECT id, name, email FROM students WHERE status = 'verified'`;
    const studentParams = [];

    if (classDetails.college_id) {
      studentQuery += ' AND college_id = ?';
      studentParams.push(classDetails.college_id);
    }
    if (classDetails.course_id) {
      studentQuery += ' AND id IN (SELECT student_id FROM student_courses WHERE course_id = ?)';
      studentParams.push(classDetails.course_id);
    }

    const [students] = await connection.query(studentQuery, studentParams);

    // Send email to each student
    for (const student of students) {
      await sendClassMaterialsEmail(student.email, student.name, classDetails);
    }

    res.json({ success: true, message: `Notifications sent to ${students.length} students.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 8b. EMAIL THE MEETING LINK TO REGISTERED STUDENTS
// ==========================================
router.post('/:id/notify-link', async (req, res) => {
  const classId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [[classDetails]] = await connection.query('SELECT * FROM live_classes WHERE id = ?', [classId]);
    if (!classDetails) {
      return res.status(404).json({ error: 'Class not found' });
    }
    if (!classDetails.meet_link) {
      return res.status(400).json({ error: 'This class has no meeting link yet.' });
    }

    let studentQuery = `SELECT id, name, email FROM students WHERE status = 'verified'`;
    const studentParams = [];
    if (classDetails.college_id) {
      studentQuery += ' AND college_id = ?';
      studentParams.push(classDetails.college_id);
    }
    if (classDetails.course_id) {
      studentQuery += ' AND id IN (SELECT student_id FROM student_courses WHERE course_id = ?)';
      studentParams.push(classDetails.course_id);
    }
    const [students] = await connection.query(studentQuery, studentParams);

    for (const student of students) {
      await sendClassReminderEmail(student.email, student.name, classDetails);
    }
    res.json({ success: true, message: `Meeting link emailed to ${students.length} students.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 9. SUBMIT/VIEW CLASS FEEDBACK
// ==========================================

// Student submits feedback (this would be on a student-auth route)
router.post('/:id/feedback', async (req, res) => {
  const { student_id, rating, comment } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO class_feedback (class_id, student_id, rating, comment) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = ?, comment = ?`,
      [req.params.id, student_id, rating, comment, rating, comment]
    );
    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Admin views feedback for a class
router.get('/:id/feedback', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [feedback] = await connection.query('SELECT cf.*, s.name as student_name FROM class_feedback cf JOIN students s ON cf.student_id = s.id WHERE cf.class_id = ?', [req.params.id]);
    res.json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;