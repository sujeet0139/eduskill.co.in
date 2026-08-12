const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');
const { requireAdmin } = require('../middleware/authMiddleware');

const pdfUpload = makeUpload({
  folder: 'eduskill/course-content',
  prefix: 'course-pdf-',
  maxSize: 20 * 1024 * 1024,
  allowedExt: /pdf/,
  allowedMime: ['application/pdf'],
});

const imageUpload = makeUpload({
  folder: 'eduskill/course-images',
  prefix: 'course-img-',
  maxSize: 3 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp/,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
});

// UPLOAD COURSE CONTENT PDF -> returns the public URL (admin pastes/saves it on the course)
router.post('/upload-content', requireAdmin, pdfUpload.single('pdf'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'PDF file is required.' });
  res.json({ success: true, url });
});

// UPLOAD COURSE THUMBNAIL/BANNER IMAGE -> returns the public URL (item #25)
router.post('/upload-image', requireAdmin, imageUpload.single('image'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'Image file is required.' });
  res.json({ success: true, url });
});

// GET ALL COURSES
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [courses] = await connection.query('SELECT * FROM courses ORDER BY created_at DESC');
    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW COURSE
router.post('/', requireAdmin, async (req, res) => {
  const { title, category, subject, description, content_pdf, image_url, duration_weeks, price, min_payment, language, level, status, track_id } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO courses (title, category, track_id, subject, description, content_pdf, image_url, duration_weeks, price, min_payment, language, level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, category, track_id || null, subject || null, description, content_pdf || null, image_url || null, duration_weeks, price || 0, min_payment || 0, language, level, status || 'draft']
    );
    res.json({ success: true, message: 'Course created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE COURSE
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, category, subject, description, content_pdf, image_url, duration_weeks, price, min_payment, language, level, status, track_id } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE courses SET title=?, category=?, track_id=?, subject=?, description=?, content_pdf=?, image_url=?, duration_weeks=?, price=?, min_payment=?, language=?, level=?, status=? WHERE id=?`,
      [title, category, track_id || null, subject || null, description, content_pdf || null, image_url || null, duration_weeks, price || 0, min_payment || 0, language, level, status, req.params.id]
    );
    res.json({ success: true, message: 'Course updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE COURSE
router.delete('/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM courses WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
