const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendWelcomeEmail } = require('../email');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/authMiddleware');
const { validateStudentFields, normalizeMobile, isValidPan } = require('../lib/validators');
const { logRegistrationFailure } = require('../lib/failureLog');

// STUDENT REGISTRATION ENDPOINT
router.post('/register', async (req, res) => {
  const studentData = req.body;
  let connection;

  try {
    connection = await pool.getConnection();

    // Fetch dynamic field validation rules
    const [fields] = await connection.query('SELECT * FROM registration_fields WHERE is_enabled = TRUE');

    // Dynamic Validation
    for (const field of fields) {
      if (field.is_mandatory && !studentData[field.field_name]) {
        return res.status(400).json({ error: `${field.label} is a required field.` });
      }
      if (field.field_name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentData.email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      if (field.field_name === 'password' && (!studentData.password || studentData.password.length < 6)) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
    }

    // Format validation for mobile / aadhar / pan (email handled above).
    const fmtErr = validateStudentFields(studentData);
    if (fmtErr) {
      return res.status(400).json({ error: fmtErr });
    }
    // Normalize stored values so lookups & display are consistent.
    if (studentData.phone) studentData.phone = normalizeMobile(studentData.phone);
    if (studentData.pan) studentData.pan = String(studentData.pan).trim().toUpperCase();
    if (studentData.aadhar) studentData.aadhar = String(studentData.aadhar).replace(/\s/g, '');

    const [existingEmail] = await connection.query(
      'SELECT id FROM students WHERE email = ?',
      [studentData.email]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate Enrollment ID (e.g., ENR240001)
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const [[lastStudent]] = await connection.query("SELECT id FROM students ORDER BY id DESC LIMIT 1");
    const nextId = (lastStudent ? lastStudent.id : 0) + 1;
    const enrollmentId = `ENR${currentYear}${String(nextId).padStart(4, '0')}`;

    const referenceNo = 'SKC' + Date.now();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(studentData.password, salt);

    // Separate standard and custom fields
    const standardFields = fields.filter(f => f.is_standard).map(f => f.field_name);
    const customFields = fields.filter(f => !f.is_standard);

    const [result] = await connection.query(
      `INSERT INTO students (enrollment_id, reference_no, name, email, password_hash, phone, aadhar, pan, roll_number, current_year, college_id, department, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [enrollmentId, referenceNo, studentData.name, studentData.email, passwordHash, studentData.phone, studentData.aadhar || null, studentData.pan || null, studentData.roll_number || null, studentData.current_year || 1, studentData.collegeId, studentData.department, 'registered']
    );
    const studentId = result.insertId;

    // Insert custom field data into the new table
    for (const customField of customFields) {
      const value = studentData[customField.field_name];
      if (value) {
        await connection.query('INSERT INTO student_custom_fields (student_id, field_id, value) VALUES (?, ?, ?)', [studentId, customField.id, value]);
      }
    }

    // SEND CONFIRMATION EMAIL — fire-and-forget. Registration must never hang
    // waiting on a slow/unreachable SMTP server (this was the root cause of
    // the "please wait forever" hang — see email.js for the added timeouts).
    sendWelcomeEmail(studentData.email, studentData.name, referenceNo)
      .catch((emailErr) => console.error('Email sending failed:', emailErr.message));

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      referenceNo: referenceNo,
      enrollmentId: enrollmentId,
      studentId: studentId,
      email: studentData.email
    });

  } catch (error) {
    console.error('Registration error:', error);
    logRegistrationFailure('public_register', studentData, error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET ALL STUDENTS (ADMIN)
router.get('/', requireAdmin, async (req, res) => {
  const { district, collegeId, status, paymentStatus } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();

    let query = `
      SELECT s.*, c.name as college_name, d.name as district_name,
             (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = 'completed') as total_paid
      FROM students s
      LEFT JOIN colleges c ON s.college_id = c.id
      LEFT JOIN districts d ON c.district_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (district) { query += ' AND d.id = ?'; params.push(district); }
    if (collegeId) { query += ' AND c.id = ?'; params.push(collegeId); }
    if (status) { query += ' AND s.status = ?'; params.push(status); }

    if (paymentStatus === 'paid') {
      query += ' AND (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") > 0';
    } else if (paymentStatus === 'unpaid') {
      query += ' AND ((SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") IS NULL OR (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") = 0)';
    }

    query += ' ORDER BY s.created_at DESC';

    const [students] = await connection.query(query, params);

    res.json({
      success: true,
      count: students.length,
      students: students
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// EXPORT STUDENTS AS CSV
router.get('/export', requireAdmin, async (req, res) => {
  const { q, status, collegeId } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let query = `
      SELECT s.id, s.enrollment_id, s.reference_no, s.name, s.email, s.phone, c.name as college_name, s.status, s.created_at
      FROM students s
      LEFT JOIN colleges c ON s.college_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (collegeId) {
      query += ' AND s.college_id = ?';
      params.push(collegeId);
    }

    if (q) {
      const like = `%${q}%`;
      query += ` AND (
        s.name LIKE ? OR
        s.email LIKE ? OR
        s.reference_no LIKE ? OR
        s.phone LIKE ? OR
        c.name LIKE ?
      )`;
      params.push(like, like, like, like, like);
    }

    query += ' ORDER BY s.created_at DESC';
    const [students] = await connection.query(query, params);

    const csvRows = [
      [
        'Student ID',
        'Enrollment ID',
        'Reference No',
        'Name',
        'Email',
        'Phone',
        'College',
        'Status',
        'Created At',
      ].join(','),
    ];

    students.forEach((student) => {
      csvRows.push([
        student.id,
        student.enrollment_id || '',
        student.reference_no || '',
        `"${(student.name || '').replace(/"/g, '""')}"`,
        student.email || '',
        student.phone || '',
        `"${(student.college_name || '').replace(/"/g, '""')}"`,
        student.status || '',
        student.created_at ? student.created_at.toISOString() : '',
      ].join(','));
    });

    const csvData = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="eduskill-students-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET FULL STUDENT PROFILE (Basic, Financial, Learning, Internship)
//
// Only the "basic" lookup is treated as fatal (404 if the student doesn't
// exist). Every other section is fetched independently via Promise.allSettled
// so a failure in one (e.g. a stale join, a locked table) degrades that one
// section instead of blanking the whole profile — this was a real gap: any
// single query throwing here previously failed the entire page with no way
// to tell which part broke, and (separately, see the connection-leak fix
// below) never released its DB connection either.
router.get('/:id/full-profile', requireAdmin, async (req, res) => {
  const studentId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();

    // Basic details — the one query that must succeed.
    const [[basic]] = await connection.query(`
      SELECT s.*, c.name as college_name, d.name as district_name
      FROM students s LEFT JOIN colleges c ON s.college_id = c.id LEFT JOIN districts d ON c.district_id = d.id
      WHERE s.id = ?`, [studentId]);

    if (!basic) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const sections = await Promise.allSettled([
      connection.query(`SELECT SUM(amount) as total_paid FROM payments WHERE student_id = ? AND status = 'completed'`, [studentId]),
      connection.query(`SELECT * FROM payments WHERE student_id = ? ORDER BY created_at DESC`, [studentId]),
      connection.query(`SELECT sc.*, c.title FROM student_courses sc JOIN courses c ON sc.course_id = c.id WHERE sc.student_id = ?`, [studentId]),
      connection.query(`SELECT COUNT(*) as attended_classes FROM class_attendance WHERE student_id = ? AND status = 'present'`, [studentId]),
      connection.query(`SELECT * FROM assignment_submissions WHERE student_id = ?`, [studentId]),
      connection.query(`SELECT * FROM student_documents WHERE student_id = ?`, [studentId]),
      connection.query(`SELECT * FROM certificates WHERE student_id = ?`, [studentId]),
      connection.query(`
        SELECT rf.label, rf.field_name, scf.value
        FROM student_custom_fields scf
        JOIN registration_fields rf ON scf.field_id = rf.id
        WHERE scf.student_id = ?`, [studentId]),
      connection.query(`SELECT sp.*, p.title as program_title FROM student_programs sp JOIN programs p ON sp.program_id = p.id WHERE sp.student_id = ?`, [studentId]),
    ]);

    const warnings = [];
    const rowsOf = (result, label, fallback) => {
      if (result.status === 'fulfilled') return result.value[0];
      console.error(`full-profile: ${label} query failed for student ${studentId}:`, result.reason.message);
      warnings.push(label);
      return fallback;
    };
    const [
      totalPaidRows, paymentsRows, coursesRows, attendanceRows,
      assignmentsRows, documentsRows, certificatesRows, customFieldsRows, internshipsRows,
    ] = sections;

    const financialTotal = rowsOf(totalPaidRows, 'financial_total', [{ total_paid: 0 }])[0];
    const payments = rowsOf(paymentsRows, 'payments', []);
    const courses = rowsOf(coursesRows, 'courses', []);
    const attendance = rowsOf(attendanceRows, 'attendance', [{ attended_classes: 0 }])[0];
    const assignments = rowsOf(assignmentsRows, 'assignments', []);
    const documents = rowsOf(documentsRows, 'documents', []);
    const certificates = rowsOf(certificatesRows, 'certificates', []);
    const customFields = rowsOf(customFieldsRows, 'customFields', []);
    const internships = rowsOf(internshipsRows, 'internships', []);

    res.json({
      success: true,
      profile: {
        basic,
        financial: { wallet_balance: basic.wallet_balance, total_paid: financialTotal.total_paid || 0, payments },
        learning: { courses, attended_classes: attendance.attended_classes, assignments, certificates, documents, customFields },
        internships,
        // Non-fatal — lets the admin panel show "some details couldn't load"
        // instead of silently rendering zeros/empties as if that were real data.
        warnings: warnings.length ? warnings : undefined,
      }
    });
  } catch (error) {
    console.error('full-profile error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/students/:id/id-card - Data for generating a student ID card
router.get('/:id/id-card', requireAdmin, async (req, res) => {
  const studentId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const [[student]] = await connection.query(`
      SELECT
        s.name, s.enrollment_id, s.dob, s.father_name, s.phone, s.address_permanent,
        c.name as college_name,
        (SELECT file_url FROM student_documents WHERE student_id = s.id AND document_type = 'photo' AND status = 'verified' LIMIT 1) as photo_url,
        (SELECT file_url FROM student_documents WHERE student_id = s.id AND document_type = 'signature' AND status = 'verified' LIMIT 1) as signature_url
      FROM students s
      LEFT JOIN colleges c ON s.college_id = c.id
      WHERE s.id = ?
    `, [studentId]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, idCardData: student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// STUDENT: UPLOAD A DOCUMENT
const docUpload = require('../config/storage').makeUpload({
  folder: 'eduskill/documents',
  prefix: 'doc-',
  maxSize: 5 * 1024 * 1024, // 5MB limit
  allowedExt: /jpeg|jpg|png|pdf/,
  allowedMime: ['image/jpeg', 'image/png', 'application/pdf']
});

router.post('/upload-document', docUpload.single('document'), async (req, res) => {
  const { student_id, document_type } = req.body;
  const file = req.file;

  if (!student_id || !document_type || !file) {
    return res.status(400).json({ error: 'Student ID, document type, and a file are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const fileUrl = require('../config/storage').fileUrl(file);
    await connection.query('INSERT INTO student_documents (student_id, document_type, file_url, file_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), file_name = VALUES(file_name), status = "pending_verification"', [student_id, document_type, fileUrl, file.originalname]);
    res.json({ success: true, message: 'Document uploaded successfully. It will be reviewed by our team.' });
  } catch (error) {
    res.status(500).json({ error: 'Document upload failed', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: UPDATE DOCUMENT STATUS
router.put('/documents/:docId/status', requireAdmin, async (req, res) => {
  const { status, notes } = req.body;
  const { docId } = req.params;

  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status provided.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE student_documents SET status = ?, notes = ? WHERE id = ?', [status, notes || null, docId]);
    res.json({ success: true, message: `Document status updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document status', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE STUDENT
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, email, phone, collegeId, department, status, roll_number, current_year, wallet_balance } = req.body;
  let connection;
  try {
    const fmtErr = validateStudentFields({ email, phone });
    if (fmtErr) return res.status(400).json({ error: fmtErr });
    const normPhone = phone ? normalizeMobile(phone) : phone;
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE students SET name=?, email=?, phone=?, college_id=?, department=?, status=?, roll_number=?, current_year=?, wallet_balance=? WHERE id=?',
      [name, email, normPhone, collegeId, department, status, roll_number, current_year, wallet_balance, req.params.id]
    );
    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE STUDENT
router.delete('/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM students WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// VERIFY STUDENT
router.put('/:id/verify', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE students SET status="verified" WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Student verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// BULK VERIFY STUDENTS
router.post('/bulk-verify', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE students SET status="verified" WHERE id IN (?)', [ids]);
    res.json({ success: true, message: 'Students verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// BULK IMPORT STUDENTS (CSV/JSON Array)
router.post('/bulk-import', requireAdmin, async (req, res) => {
  const { students } = req.body; // Expects array of objects

  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload. Expected an array of student objects.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    let imported = 0;
    let errors = [];

    for (const st of students) {
      const ref = 'SKC' + Date.now() + Math.floor(Math.random() * 1000);
      try {
        const fmtErr = validateStudentFields(st);
        if (fmtErr) { errors.push({ email: st.email, error: fmtErr }); continue; }
        if (st.phone) st.phone = normalizeMobile(st.phone);
        await connection.query(
          `INSERT INTO students (reference_no, name, email, phone, roll_number, current_year, college_id, department)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [ref, st.name, st.email, st.phone, st.roll_number || null, st.current_year || 1, st.college_id, st.department || null]
        );
        imported++;
      } catch (err) {
        errors.push({ email: st.email, error: err.message });
      }
    }
    res.json({ success: true, message: `Successfully imported ${imported} students`, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: ADD A SINGLE STUDENT (manual enrollment)
// Generates enrollment id + reference no. Password optional — if omitted we
// generate a random temporary one and return it so the admin can share it.
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, phone, collegeId, department, roll_number, current_year, aadhar, pan } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });

  const fmtErr = validateStudentFields({ email, phone, aadhar, pan });
  if (fmtErr) return res.status(400).json({ error: fmtErr });

  let connection;
  try {
    connection = await pool.getConnection();
    const [existing] = await connection.query('SELECT id FROM students WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const currentYear = new Date().getFullYear().toString().slice(-2);
    const [[lastStudent]] = await connection.query('SELECT id FROM students ORDER BY id DESC LIMIT 1');
    const nextId = (lastStudent ? lastStudent.id : 0) + 1;
    const enrollmentId = `ENR${currentYear}${String(nextId).padStart(4, '0')}`;
    const referenceNo = 'SKC' + Date.now();

    // Generate a temporary password the admin can hand to the student.
    const tempPassword = req.body.password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));

    const [result] = await connection.query(
      `INSERT INTO students (enrollment_id, reference_no, name, email, password_hash, phone, aadhar, pan, roll_number, current_year, college_id, department, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered')`,
      [enrollmentId, referenceNo, name, email, passwordHash, phone ? normalizeMobile(phone) : null,
       aadhar || null, pan ? String(pan).toUpperCase() : null, roll_number || null, current_year || 1,
       collegeId || null, department || null]
    );

    // Fire-and-forget — never let a slow/unreachable SMTP server delay this
    // response (was the root cause of "Add Student" hanging on "please wait").
    sendWelcomeEmail(email, name, referenceNo)
      .catch((e) => console.error('Welcome email failed:', e.message));

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      studentId: result.insertId,
      enrollmentId,
      referenceNo,
      // Only returned when we generated the password, so the admin can share it.
      tempPassword: req.body.password ? undefined : tempPassword,
    });
  } catch (error) {
    console.error('Add student error:', error);
    logRegistrationFailure('admin_add_student', req.body, error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: LIST A STUDENT'S ENROLLMENTS (courses + programs, with batch & status)
router.get('/:id/enrollments', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [courses] = await connection.query(
      `SELECT sc.course_id AS item_id, c.title, sc.batch_id, b.name AS batch_name, sc.status, sc.enrolled_at
       FROM student_courses sc JOIN courses c ON c.id = sc.course_id
       LEFT JOIN batches b ON b.id = sc.batch_id
       WHERE sc.student_id = ? ORDER BY sc.enrolled_at DESC`, [req.params.id]);
    const [programs] = await connection.query(
      `SELECT sp.program_id AS item_id, p.title, sp.batch_id, b.name AS batch_name, sp.status, sp.enrolled_at
       FROM student_programs sp JOIN programs p ON p.id = sp.program_id
       LEFT JOIN batches b ON b.id = sp.batch_id
       WHERE sp.student_id = ? ORDER BY sp.enrolled_at DESC`, [req.params.id]);
    res.json({ success: true, courses, programs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: ENROL / UPDATE a student in a course or program (optionally in a batch).
// Idempotent: re-enrolling updates the batch/status. Keeps batch seat counts in sync.
router.post('/:id/enroll', requireAdmin, async (req, res) => {
  const { type, item_id, batch_id, status } = req.body;
  if (!['course', 'program'].includes(type) || !item_id) {
    return res.status(400).json({ error: 'type (course|program) and item_id are required.' });
  }
  const table = type === 'course' ? 'student_courses' : 'student_programs';
  const fk = type === 'course' ? 'course_id' : 'program_id';
  let connection;
  try {
    connection = await pool.getConnection();
    // Was the student already enrolled (and in which batch)?
    const [[existing]] = await connection.query(
      `SELECT id, batch_id FROM ${table} WHERE student_id = ? AND ${fk} = ?`, [req.params.id, item_id]);

    await connection.query(
      `INSERT INTO ${table} (student_id, ${fk}, batch_id, status) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE batch_id = VALUES(batch_id), status = VALUES(status)`,
      [req.params.id, item_id, batch_id || null, status || 'enrolled']);

    // Keep batch seat counts correct when the batch assignment changes.
    const oldBatch = existing ? existing.batch_id : null;
    const newBatch = batch_id || null;
    if (String(oldBatch) !== String(newBatch)) {
      if (oldBatch) await connection.query('UPDATE batches SET current_enrolled = GREATEST(current_enrolled - 1, 0) WHERE id = ?', [oldBatch]);
      if (newBatch) await connection.query('UPDATE batches SET current_enrolled = current_enrolled + 1 WHERE id = ?', [newBatch]);
    }
    res.json({ success: true, message: existing ? 'Enrollment updated.' : 'Student enrolled.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: UNENROL a student from a course or program.
router.delete('/:id/enroll', requireAdmin, async (req, res) => {
  const { type, item_id } = req.query;
  if (!['course', 'program'].includes(type) || !item_id) {
    return res.status(400).json({ error: 'type (course|program) and item_id are required.' });
  }
  const table = type === 'course' ? 'student_courses' : 'student_programs';
  const fk = type === 'course' ? 'course_id' : 'program_id';
  let connection;
  try {
    connection = await pool.getConnection();
    const [[existing]] = await connection.query(
      `SELECT batch_id FROM ${table} WHERE student_id = ? AND ${fk} = ?`, [req.params.id, item_id]);
    await connection.query(`DELETE FROM ${table} WHERE student_id = ? AND ${fk} = ?`, [req.params.id, item_id]);
    if (existing && existing.batch_id) {
      await connection.query('UPDATE batches SET current_enrolled = GREATEST(current_enrolled - 1, 0) WHERE id = ?', [existing.batch_id]);
    }
    res.json({ success: true, message: 'Student unenrolled.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: SET / GENERATE A STUDENT'S PASSWORD
// If `password` is provided it is used; otherwise a random one is generated and
// returned so the admin can share it (e.g. via WhatsApp/email).
router.put('/:id/set-password', requireAdmin, async (req, res) => {
  let { password } = req.body;
  const generated = !password;
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  if (!password) password = Math.random().toString(36).slice(-8);

  let connection;
  try {
    connection = await pool.getConnection();
    const [[student]] = await connection.query('SELECT id, email, name FROM students WHERE id = ?', [req.params.id]);
    if (!student) { return res.status(404).json({ error: 'Student not found.' }); }
    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await connection.query('UPDATE students SET password_hash = ? WHERE id = ?', [passwordHash, req.params.id]);
    res.json({
      success: true,
      message: 'Password updated successfully.',
      email: student.email,
      // Return the plaintext ONLY when we generated it, so the admin can share it.
      password: generated ? password : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ADMIN: UPLOAD / REPLACE A STUDENT'S PHOTO (or signature) directly.
// Reuses the shared document store; marks it verified since an admin uploaded it.
router.post('/:id/photo', requireAdmin, docUpload.single('document'), async (req, res) => {
  const file = req.file;
  const document_type = req.body.document_type || 'photo';
  if (!file) return res.status(400).json({ error: 'A file is required.' });
  if (!['photo', 'signature'].includes(document_type)) {
    return res.status(400).json({ error: 'document_type must be "photo" or "signature".' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const url = require('../config/storage').fileUrl(file);
    await connection.query(
      `INSERT INTO student_documents (student_id, document_type, file_url, file_name, status)
       VALUES (?, ?, ?, ?, 'verified')
       ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), file_name = VALUES(file_name), status = 'verified'`,
      [req.params.id, document_type, url, file.originalname]
    );
    res.json({ success: true, message: 'Photo uploaded successfully.', url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
