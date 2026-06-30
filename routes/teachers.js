const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');
const { requireAdmin } = require('../middleware/authMiddleware'); // Already present

// Profile photo upload middleware (up to 2MB)
const upload = makeUpload({
  folder: 'eduskill/teachers',
  prefix: 'teacher-',
  maxSize: 2 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp/,
  allowedMime: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
});

// 1. GET ALL TEACHERS WITH PAGINATION, SEARCH, AND STATUS FILTER
router.get('/', requireAdmin, async (req, res) => { // requireAdmin is correctly here
  let connection;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const q = req.query.q || '';
    const status = req.query.status || '';

    connection = await pool.getConnection();

    let queryStr = 'FROM teachers WHERE 1=1';
    const queryParams = [];

    if (q) {
      queryStr += ' AND (name LIKE ? OR subject LIKE ? OR email LIKE ? OR mobile LIKE ? OR teacher_id LIKE ?)';
      const likeParam = `%${q}%`;
      queryParams.push(likeParam, likeParam, likeParam, likeParam, likeParam);
    }

    if (status) {
      queryStr += ' AND status = ?';
      queryParams.push(status);
    }

    // Get total count for pagination headers
    const [countResult] = await connection.query(`SELECT COUNT(*) as total ${queryStr}`, queryParams);
    const total = countResult[0].total;

    // Get paginated data
    queryStr += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const [teachers] = await connection.query(`SELECT * ${queryStr}`, queryParams);

    res.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      teachers
    });
  } catch (error) {
    console.error('Error fetching teachers list:', error);
    res.status(500).json({ error: 'Failed to fetch teachers list', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 2. GET TEACHER DETAILS BY ID
router.get('/:id', requireAdmin, async (req, res) => { // requireAdmin is correctly here
  let connection;
  try {
    connection = await pool.getConnection();
    const identifier = req.params.id;

    // Can fetch by primary key id or by TRxxxx code
    const query = identifier.startsWith('TR') 
      ? 'SELECT * FROM teachers WHERE teacher_id = ?'
      : 'SELECT * FROM teachers WHERE id = ?';

    const [rows] = await connection.query(query, [identifier]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({ success: true, teacher: rows[0] });
  } catch (error) {
    console.error('Error fetching teacher details:', error);
    res.status(500).json({ error: 'Failed to fetch teacher details', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 3. CREATE NEW TEACHER (WITH TRANSACTION FOR SAFE AUTO-GENERATED ID)
router.post('/', requireAdmin, upload.single('profile_photo'), async (req, res) => {
  const {
    name, subject, expertise, qualification, experience, 
    mobile, email, gender, dob, address, available_time,
    status, joining_date, class_timing, remarks
  } = req.body;

  if (!name || !email || !mobile) {
    return res.status(400).json({ error: 'Full Name, Email, and Mobile Number are required.' });
  }

  const profilePhotoUrl = fileUrl(req.file);
  let connection;

  try {
    connection = await pool.getConnection();

    // Check if email already exists
    const [existing] = await connection.query('SELECT id FROM teachers WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email ID is already registered.' });
    }

    await connection.beginTransaction();

    const insertQuery = `
      INSERT INTO teachers (
        teacher_id, name, subject, expertise, qualification, experience, 
        mobile, email, gender, dob, address, available_time, 
        profile_photo, status, joining_date, class_timing, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      'TR_TEMP', // Temporary placeholder
      name,
      subject || null,
      expertise || null,
      qualification || null,
      experience || null,
      mobile,
      email,
      gender || null,
      dob ? new Date(dob) : null,
      address || null,
      available_time || null,
      profilePhotoUrl || null,
      status || 'Active',
      joining_date ? new Date(joining_date) : null,
      class_timing || null,
      remarks || null
    ];

    const [result] = await connection.query(insertQuery, values);
    const insertId = result.insertId;

    // Generate padded TR sequence, e.g. TR0001
    const teacherId = 'TR' + String(insertId).padStart(4, '0');

    // Update with real teacher_id
    await connection.query('UPDATE teachers SET teacher_id = ? WHERE id = ?', [teacherId, insertId]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Teacher registered successfully',
      teacher: {
        id: insertId,
        teacher_id: teacherId,
        name,
        email
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error registering teacher:', error);
    res.status(500).json({ error: 'Teacher registration failed', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 4. UPDATE TEACHER
router.put('/:id', requireAdmin, upload.single('profile_photo'), async (req, res) => { // requireAdmin is correctly here
  const teacherId = req.params.id;
  const {
    name, subject, expertise, qualification, experience, 
    mobile, email, gender, dob, address, available_time,
    status, joining_date, class_timing, remarks
  } = req.body;

  if (!name || !email || !mobile) {
    return res.status(400).json({ error: 'Full Name, Email, and Mobile Number are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Check if teacher exists
    const [existing] = await connection.query('SELECT id, profile_photo FROM teachers WHERE id = ?', [teacherId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Check if email is taken by another teacher
    const [emailCheck] = await connection.query('SELECT id FROM teachers WHERE email = ? AND id != ?', [email, teacherId]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Email ID is already in use by another teacher.' });
    }

    // Determine photo URL (keep existing if no new upload)
    const newPhotoUrl = req.file ? fileUrl(req.file) : existing[0].profile_photo;

    const updateQuery = `
      UPDATE teachers SET 
        name = ?, subject = ?, expertise = ?, qualification = ?, experience = ?, 
        mobile = ?, email = ?, gender = ?, dob = ?, address = ?, available_time = ?, 
        profile_photo = ?, status = ?, joining_date = ?, class_timing = ?, remarks = ?
      WHERE id = ?
    `;

    const values = [
      name,
      subject || null,
      expertise || null,
      qualification || null,
      experience || null,
      mobile,
      email,
      gender || null,
      dob ? new Date(dob) : null,
      address || null,
      available_time || null,
      newPhotoUrl || null,
      status || 'Active',
      joining_date ? new Date(joining_date) : null,
      class_timing || null,
      remarks || null,
      teacherId
    ];

    await connection.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Teacher details updated successfully'
    });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ error: 'Failed to update teacher details', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 5. DELETE TEACHER
router.delete('/:id', requireAdmin, async (req, res) => { // requireAdmin is correctly here
  let connection;
  try {
    connection = await pool.getConnection();
    const teacherId = req.params.id;

    // Check if teacher exists
    const [existing] = await connection.query('SELECT id FROM teachers WHERE id = ?', [teacherId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    await connection.query('DELETE FROM teachers WHERE id = ?', [teacherId]);

    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ error: 'Failed to delete teacher', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
