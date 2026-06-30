const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');

const pdfUpload = makeUpload({
  folder: 'eduskill/course-content',
  prefix: 'course-pdf-',
  maxSize: 20 * 1024 * 1024,
  allowedExt: /pdf/,
  allowedMime: ['application/pdf'],
});

// UPLOAD COURSE CONTENT PDF -> returns the public URL (admin pastes/saves it on the course)
router.post('/upload-content', pdfUpload.single('pdf'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'PDF file is required.' });
  res.json({ success: true, url });
});

// GET ALL COURSES
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [courses] = await connection.query('SELECT * FROM courses ORDER BY created_at DESC');
    connection.release();
    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW COURSE
router.post('/', async (req, res) => {
  const { title, category, subject, description, content_pdf, duration_weeks, price, min_payment, language, level, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO courses (title, category, subject, description, content_pdf, duration_weeks, price, min_payment, language, level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, category, subject || null, description, content_pdf || null, duration_weeks, price || 0, min_payment || 0, language, level, status || 'draft']
    );
    connection.release();
    res.json({ success: true, message: 'Course created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE COURSE
router.put('/:id', async (req, res) => {
  const { title, category, subject, description, content_pdf, duration_weeks, price, min_payment, language, level, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE courses SET title=?, category=?, subject=?, description=?, content_pdf=?, duration_weeks=?, price=?, min_payment=?, language=?, level=?, status=? WHERE id=?`,
      [title, category, subject || null, description, content_pdf || null, duration_weeks, price || 0, min_payment || 0, language, level, status, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Course updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE COURSE
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM courses WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;