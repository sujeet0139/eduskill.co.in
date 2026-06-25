const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL FACULTY
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [faculty] = await connection.query(`
      SELECT f.*, c.name as college_name 
      FROM faculty f
      LEFT JOIN colleges c ON f.college_id = c.id
      ORDER BY f.name ASC
    `);
    connection.release();
    res.json({ success: true, faculty });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW FACULTY
router.post('/', async (req, res) => {
  const { name, email, phone, expertise, college_id, hourly_rate } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO faculty (name, email, phone, expertise, college_id, hourly_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, expertise, college_id || null, hourly_rate || 0]
    );
    connection.release();
    res.json({ success: true, message: 'Faculty added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE FACULTY
router.put('/:id', async (req, res) => {
  const { name, email, phone, expertise, college_id, hourly_rate } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE faculty SET name=?, email=?, phone=?, expertise=?, college_id=?, hourly_rate=? WHERE id=?',
      [name, email, phone, expertise, college_id || null, hourly_rate || 0, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Faculty updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE FACULTY
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM faculty WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Faculty deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;