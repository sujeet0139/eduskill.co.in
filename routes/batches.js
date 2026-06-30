const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL BATCHES (with course/program/mentor names)
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [batches] = await connection.query(`
      SELECT b.*, c.title AS course_title, p.title AS program_title, f.name AS mentor_name
      FROM batches b
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN faculty f ON b.mentor_id = f.id
      ORDER BY b.start_date DESC, b.id DESC
    `);
    connection.release();
    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE BATCH
router.post('/', async (req, res) => {
  const { name, course_id, program_id, mentor_id, start_date, end_date, max_students, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO batches (name, course_id, program_id, mentor_id, start_date, end_date, max_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, course_id || null, program_id || null, mentor_id || null, start_date || null, end_date || null, max_students || 30, status || 'open']
    );
    connection.release();
    res.json({ success: true, message: 'Batch created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE BATCH
router.put('/:id', async (req, res) => {
  const { name, course_id, program_id, mentor_id, start_date, end_date, max_students, status } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE batches SET name=?, course_id=?, program_id=?, mentor_id=?, start_date=?, end_date=?, max_students=?, status=? WHERE id=?`,
      [name, course_id || null, program_id || null, mentor_id || null, start_date || null, end_date || null, max_students || 30, status, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Batch updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE BATCH
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM batches WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
