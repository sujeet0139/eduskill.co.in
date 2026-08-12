const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Validate a batch's date range. Returns an error string, or null if OK.
// Both dates are optional, but if both are present end must be after start.
function validateBatchDates(start_date, end_date) {
  if (start_date && isNaN(Date.parse(start_date))) return 'Invalid start date.';
  if (end_date && isNaN(Date.parse(end_date))) return 'Invalid end date.';
  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return 'End date must be on or after the start date.';
  }
  return null;
}

// GET ALL BATCHES (with course/program/mentor/teacher names)
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [batches] = await connection.query(`
      SELECT b.*, c.title AS course_title, p.title AS program_title, f.name AS mentor_name, t.name AS teacher_name
      FROM batches b
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN programs p ON b.program_id = p.id
      LEFT JOIN faculty f ON b.mentor_id = f.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      ORDER BY b.start_date DESC, b.id DESC
    `);
    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE BATCH
router.post('/', async (req, res) => {
  const { name, course_id, program_id, mentor_id, teacher_id, start_date, end_date, max_students, status } = req.body;
  let connection;
  try {
    const dateErr = validateBatchDates(start_date, end_date);
    if (dateErr) return res.status(400).json({ error: dateErr });
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO batches (name, course_id, program_id, mentor_id, teacher_id, start_date, end_date, max_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, course_id || null, program_id || null, mentor_id || null, teacher_id || null, start_date || null, end_date || null, max_students || 30, status || 'open']
    );
    res.json({ success: true, message: 'Batch created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE BATCH
router.put('/:id', async (req, res) => {
  const { name, course_id, program_id, mentor_id, teacher_id, start_date, end_date, max_students, status } = req.body;
  let connection;
  try {
    const dateErr = validateBatchDates(start_date, end_date);
    if (dateErr) return res.status(400).json({ error: dateErr });
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE batches SET name=?, course_id=?, program_id=?, mentor_id=?, teacher_id=?, start_date=?, end_date=?, max_students=?, status=? WHERE id=?`,
      [name, course_id || null, program_id || null, mentor_id || null, teacher_id || null, start_date || null, end_date || null, max_students || 30, status, req.params.id]
    );
    res.json({ success: true, message: 'Batch updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE BATCH
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM batches WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
