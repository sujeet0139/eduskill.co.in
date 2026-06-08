const express = require('express');
const router = express.Router();
const pool = require('../config/db');

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
  const { title, category, description, duration_weeks, price, language, level, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO courses (title, category, description, duration_weeks, price, language, level, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, category, description, duration_weeks, price, language, level, status || 'draft']
    );
    connection.release();
    res.json({ success: true, message: 'Course created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE COURSE
router.put('/:id', async (req, res) => {
  const { title, category, description, duration_weeks, price, language, level, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE courses SET title=?, category=?, description=?, duration_weeks=?, price=?, language=?, level=?, status=? WHERE id=?`,
      [title, category, description, duration_weeks, price, language, level, status, req.params.id]
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