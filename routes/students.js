const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendWelcomeEmail } = require('../email');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/authMiddleware');
const { validateStudentFields, normalizeMobile, isValidPan } = require('../lib/validators');
const { logRegistrationFailure } = require('../lib/failureLog');
const { notifyStudent } = require('../lib/notify');

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

    // Say so explicitly rather than silently allowing a second account on the
    // same number (dev-prompt Priority 0 item #6) — there was previously no
    // duplicate-phone check here at all.
    if (studentData.phone) {
      const [existingPhone] = await connection.query('SELECT id FROM students WHERE phone = ?', [studentData.phone]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ error: 'This mobile/WhatsApp number is already registered.' });
      }
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

    // SEND CONFIRMATION EMAIL / SMS / WHATSAPP — fire-and-forget. Registration
    // must never hang waiting on any of these (this was the root cause of the
    // "please wait forever" hang — see email.js for the added timeouts, and
    // lib/notify.js, which no-ops safely until a gateway is configured).
    sendWelcomeEmail(studentData.email, studentData.name, referenceNo)
      .catch((emailErr) => console.error('Email sending failed:', emailErr.message));
    notifyStudent(studentData.phone, `Welcome to EduSkill! Your registration is successful. Reference No: ${referenceNo}. Login at eduskill.co.in`);

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
// Supports server-side search/filter/sort/pagination (dev-prompt item #15,
// #17) — all combine via plain AND, no page reload needed on the frontend.
const SORTABLE_COLUMNS = {
  name: 's.name',
  created_at: 's.created_at',
  registration_date: 's.created_at',
};
const PAGE_SIZES = [25, 50, 100];

router.get('/', requireAdmin, async (req, res) => {
  const {
    district, collegeId, status, paymentStatus, programId,
    q, enrollmentStatus, isActive,
    sortBy = 'created_at', sortDir = 'desc',
    page = '1', pageSize = '25',
  } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();

    let fromClause = `
      FROM students s
      LEFT JOIN colleges c ON s.college_id = c.id
      LEFT JOIN districts d ON c.district_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (district) { fromClause += ' AND d.id = ?'; params.push(district); }
    if (collegeId) { fromClause += ' AND c.id = ?'; params.push(collegeId); }
    if (status) { fromClause += ' AND s.status = ?'; params.push(status); }
    // Guest/Enrolled (item #16) — automatic field, filterable here.
    if (enrollmentStatus === 'guest' || enrollmentStatus === 'enrolled') {
      fromClause += ' AND s.enrollment_status = ?'; params.push(enrollmentStatus);
    }
    // Active/Inactive (item #18) — separate manual toggle.
    if (isActive === 'true' || isActive === 'false') {
      fromClause += ' AND s.is_active = ?'; params.push(isActive === 'true' ? 1 : 0);
    }
    if (programId) {
      fromClause += ' AND EXISTS (SELECT 1 FROM student_programs sp WHERE sp.student_id = s.id AND sp.program_id = ?)';
      params.push(programId);
    }
    if (q) {
      const like = `%${q}%`;
      fromClause += ' AND (s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ? OR s.reference_no LIKE ?)';
      params.push(like, like, like, like);
    }

    if (paymentStatus === 'paid') {
      fromClause += ' AND (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") > 0';
    } else if (paymentStatus === 'unpaid') {
      fromClause += ' AND ((SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") IS NULL OR (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = "completed") = 0)';
    }

    const [[{ total }]] = await connection.query(`SELECT COUNT(*) as total ${fromClause}`, params);

    const sortColumn = SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS.created_at;
    const sortDirection = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const size = PAGE_SIZES.includes(Number(pageSize)) ? Number(pageSize) : 25;
    const pageNum = Math.max(1, Number(page) || 1);
    const offset = (pageNum - 1) * size;

    const query = `
      SELECT s.*, c.name as college_name, d.name as district_name,
             (SELECT SUM(amount) FROM payments WHERE student_id = s.id AND status = 'completed') as total_paid
      ${fromClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;
    const [students] = await connection.query(query, [...params, size, offset]);

    res.json({
      success: true,
      count: students.length,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
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
      connection.query(`SELECT * FROM student_education WHERE student_id = ? ORDER BY level`, [studentId]),
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
      assignmentsRows, documentsRows, certificatesRows, customFieldsRows, internshipsRows, educationRows,
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
    const education = rowsOf(educationRows, 'education', []);

    // Aadhaar is a restricted field (dev-prompt item #12) — log every time an
    // admin's view of this profile surfaces it. Awaited (it's a small local
    // insert, not an external call) but failure here must never break loading
    // the rest of the profile, so it's caught and only logged, not thrown.
    if (basic.aadhar) {
      try {
        await connection.query(
          'INSERT INTO sensitive_field_access_log (student_id, field_name, accessed_by_admin_id, accessed_by_email) VALUES (?, ?, ?, ?)',
          [studentId, 'aadhar', req.admin && req.admin.id, req.admin && req.admin.email]
        );
      } catch (e) {
        console.error('sensitive_field_access_log insert failed:', e.message);
      }
    }

    res.json({
      success: true,
      profile: {
        basic,
        financial: { wallet_balance: basic.wallet_balance, total_paid: financialTotal.total_paid || 0, payments },
        learning: { courses, attended_classes: attendance.attended_classes, assignments, certificates, documents, customFields },
        internships,
        education,
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

// EDUCATIONAL BACKGROUND (dev-prompt item #13) — 10th/12th/graduate rows,
// optional, fillable post-registration, each with an uploaded certificate scan.
router.post('/:id/education', requireAdmin, docUpload.single('certificate'), async (req, res) => {
  const { level, board_university, stream, degree_name, institution, year_of_passing, percentage_or_cgpa } = req.body;
  if (!level) return res.status(400).json({ error: 'level is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const certificateUrl = req.file ? require('../config/storage').fileUrl(req.file) : null;
    await connection.query(
      `INSERT INTO student_education (student_id, level, board_university, stream, degree_name, institution, year_of_passing, percentage_or_cgpa, certificate_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, level, board_university || null, stream || null, degree_name || null, institution || null, year_of_passing || null, percentage_or_cgpa || null, certificateUrl]
    );
    res.status(201).json({ success: true, message: 'Education record added.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id/education/:eduId', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM student_education WHERE id = ? AND student_id = ?', [req.params.eduId, req.params.id]);
    res.json({ success: true, message: 'Education record removed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
// Columns PUT /:id is willing to update. The "core" ones stay required-shaped
// (always sent by the existing edit form); everything after them is the
// item #12 expansion -- optional, only written when the caller actually
// sends that key, so a small "fill in your DOB" form doesn't wipe other
// fields the way blindly overwriting every column would.
const CORE_STUDENT_FIELDS = ['name', 'email', 'phone', 'collegeId', 'department', 'status', 'roll_number', 'current_year', 'wallet_balance'];
const CORE_STUDENT_COLUMNS = { collegeId: 'college_id' };
const OPTIONAL_STUDENT_FIELDS = [
  'dob', 'gender', 'blood_group', 'emergency_contact_name', 'emergency_contact_phone',
  'linkedin_url', 'github_url', 'employment_status', 'referral_source', 'address_permanent',
  'father_name', 'mother_name', 'parent_phone',
];

router.put('/:id', requireAdmin, async (req, res) => {
  const { email, phone } = req.body;
  let connection;
  try {
    const fmtErr = validateStudentFields({ email, phone });
    if (fmtErr) return res.status(400).json({ error: fmtErr });

    const sets = [];
    const values = [];
    for (const field of CORE_STUDENT_FIELDS) {
      const column = CORE_STUDENT_COLUMNS[field] || field;
      let value = req.body[field];
      if (field === 'phone' && value) value = normalizeMobile(value);
      sets.push(`${column} = ?`);
      values.push(value ?? null);
    }
    for (const field of OPTIONAL_STUDENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        sets.push(`${field} = ?`);
        values.push(req.body[field] || null);
      }
    }

    connection = await pool.getConnection();
    await connection.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, [...values, req.params.id]);
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
    // Status change relevant to the student (dev-prompt item #9). Fetched
    // before responding so any lookup error still goes through the normal
    // error response below instead of trying to send a second response.
    const [[student]] = await connection.query('SELECT phone FROM students WHERE id = ?', [req.params.id]);
    if (student) notifyStudent(student.phone, 'Your EduSkill account has been verified. You can now log in.');
    res.json({ success: true, message: 'Student verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// TOGGLE ACTIVE/INACTIVE (dev-prompt item #18) — a manual override, separate
// from the automatic `enrollment_status` (guest/enrolled). Lets an admin mark
// e.g. an Enrolled student "on a break" Inactive without losing Enrolled history.
router.put('/:id/active-status', requireAdmin, async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive (boolean) is required.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE students SET is_active = ? WHERE id = ?', [isActive, req.params.id]);
    res.json({ success: true, message: `Student marked ${isActive ? 'Active' : 'Inactive'}.` });
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

// BULK IMPORT — sample sheet template (item #24's "Download Sample Sheet").
router.get('/import-template', requireAdmin, (req, res) => {
  const header = 'name,email,phone,roll_number,current_year,college_id,department,dob';
  const example = 'Ravi Kumar,ravi.kumar@example.com,9876543210,BCA/2024/001,1,1,Computer Science,2005-06-15';
  const csv = `${header}\n${example}\n`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="eduskill-student-import-template.csv"');
  res.send(csv);
});

// Shared validation for both the dry-run and the actual import below, so
// "validate every row before committing any" (item #24) is a real guarantee
// and not two copies of the rules drifting apart. NAME_RE/DOB range are new
// checks the old bulk-import never had; MOBILE/EMAIL reuse the same rules as
// the rest of the app.
const NAME_RE = /^[A-Za-z\s.'-]+$/;
async function validateBulkRows(connection, rows) {
  const [existingEmailRows] = await connection.query('SELECT email FROM students');
  const [existingPhoneRows] = await connection.query('SELECT phone FROM students WHERE phone IS NOT NULL');
  const [collegeRows] = await connection.query('SELECT id FROM colleges');
  const existingEmails = new Set(existingEmailRows.map((r) => r.email.toLowerCase()));
  const existingPhones = new Set(existingPhoneRows.map((r) => r.phone));
  const validCollegeIds = new Set(collegeRows.map((r) => String(r.id)));

  const seenEmails = new Set();
  const seenPhones = new Set();
  const errors = [];
  const validRows = [];

  rows.forEach((st, i) => {
    const rowNum = i + 2; // header is row 1, so first data row is 2 (matches what a spreadsheet shows)
    const rowErrors = [];

    if (!st.name || !String(st.name).trim()) rowErrors.push({ field: 'name', reason: 'Name is required.' });
    else if (!NAME_RE.test(String(st.name).trim())) rowErrors.push({ field: 'name', reason: 'Name must not contain numbers or special characters.' });

    if (!st.email) rowErrors.push({ field: 'email', reason: 'Email is required.' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(st.email)) rowErrors.push({ field: 'email', reason: 'Invalid email format.' });
    else {
      const lower = String(st.email).toLowerCase();
      if (existingEmails.has(lower)) rowErrors.push({ field: 'email', reason: 'Already registered.' });
      else if (seenEmails.has(lower)) rowErrors.push({ field: 'email', reason: 'Duplicate email within this file.' });
      else seenEmails.add(lower);
    }

    let normPhone = null;
    if (st.phone) {
      normPhone = normalizeMobile(st.phone);
      if (!isValidMobile(normPhone)) rowErrors.push({ field: 'phone', reason: 'Must be exactly 10 digits, numeric only.' });
      else if (existingPhones.has(normPhone)) rowErrors.push({ field: 'phone', reason: 'Already registered.' });
      else if (seenPhones.has(normPhone)) rowErrors.push({ field: 'phone', reason: 'Duplicate mobile number within this file.' });
      else seenPhones.add(normPhone);
    }

    if (st.college_id && !validCollegeIds.has(String(st.college_id))) {
      rowErrors.push({ field: 'college_id', reason: `No college with ID ${st.college_id} exists.` });
    }

    if (st.dob) {
      const d = new Date(st.dob);
      const ageYears = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (isNaN(d.getTime())) rowErrors.push({ field: 'dob', reason: 'Not a valid date.' });
      else if (ageYears < 10 || ageYears > 100) rowErrors.push({ field: 'dob', reason: 'Date of birth gives an implausible age.' });
    }

    if (rowErrors.length) {
      errors.push({ row: rowNum, email: st.email, errors: rowErrors });
    } else {
      validRows.push({ ...st, phone: normPhone });
    }
  });

  return { errors, validRows };
}

// VALIDATE ONLY -- no writes. Returns the full per-row error report so the
// admin sees every problem before anything is committed (item #24).
router.post('/bulk-import/validate', requireAdmin, async (req, res) => {
  const { students } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload. Expected an array of student objects.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const { errors, validRows } = await validateBulkRows(connection, students);
    res.json({ success: true, totalRows: students.length, validCount: validRows.length, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// BULK IMPORT STUDENTS (CSV/JSON Array) -- re-validates (rows can't have
// changed since the client's last /validate call, but never trust that) and
// imports only the rows that pass; every skipped row is reported, never
// silently auto-fixed.
router.post('/bulk-import', requireAdmin, async (req, res) => {
  const { students } = req.body; // Expects array of objects

  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload. Expected an array of student objects.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const { errors, validRows } = await validateBulkRows(connection, students);

    let imported = 0;
    for (const st of validRows) {
      const ref = 'SKC' + Date.now() + Math.floor(Math.random() * 1000);
      try {
        await connection.query(
          `INSERT INTO students (reference_no, name, email, phone, roll_number, current_year, college_id, department, dob)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ref, st.name, st.email, st.phone, st.roll_number || null, st.current_year || 1, st.college_id || null, st.department || null, st.dob || null]
        );
        imported++;
      } catch (err) {
        errors.push({ row: null, email: st.email, errors: [{ field: null, reason: err.message }] });
      }
    }
    res.json({
      success: true,
      message: `Successfully imported ${imported} of ${students.length} students`,
      errors: errors.length > 0 ? errors : undefined,
    });
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

    const normPhone = phone ? normalizeMobile(phone) : null;
    if (normPhone) {
      const [existingPhone] = await connection.query('SELECT id FROM students WHERE phone = ?', [normPhone]);
      if (existingPhone.length > 0) {
        return res.status(400).json({ error: 'This mobile/WhatsApp number is already registered.' });
      }
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
      [enrollmentId, referenceNo, name, email, passwordHash, normPhone,
       aadhar || null, pan ? String(pan).toUpperCase() : null, roll_number || null, current_year || 1,
       collegeId || null, department || null]
    );

    // Fire-and-forget — never let a slow/unreachable SMTP server (or SMS/
    // WhatsApp gateway) delay this response (was the root cause of "Add
    // Student" hanging on "please wait").
    sendWelcomeEmail(email, name, referenceNo)
      .catch((e) => console.error('Welcome email failed:', e.message));
    notifyStudent(normPhone, `Welcome to EduSkill, ${name}! Your account has been created. Reference No: ${referenceNo}.`);

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
