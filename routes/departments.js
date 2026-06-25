const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL DEPARTMENTS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [departments] = await connection.query(`
      SELECT d.*, c.name as college_name 
      FROM departments d
      JOIN colleges c ON d.college_id = c.id
      ORDER BY c.name ASC, d.name ASC
    `);
    connection.release();
    res.json({ success: true, departments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW DEPARTMENT
router.post('/', async (req, res) => {
  const { name, college_id, semester_count, is_active } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO departments (name, college_id, semester_count, is_active) VALUES (?, ?, ?, ?)',
      [name, college_id, semester_count || 6, is_active !== undefined ? is_active : true]
    );
    connection.release();
    res.json({ success: true, message: 'Department added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE DEPARTMENT
router.put('/:id', async (req, res) => {
  const { name, college_id, semester_count, is_active } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE departments SET name=?, college_id=?, semester_count=?, is_active=? WHERE id=?',
      [name, college_id, semester_count, is_active, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Department updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE DEPARTMENT
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM departments WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;