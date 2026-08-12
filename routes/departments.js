const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL DEPARTMENTS
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [departments] = await connection.query(`
      SELECT d.*, c.name as college_name
      FROM departments d
      JOIN colleges c ON d.college_id = c.id
      ORDER BY c.name ASC, d.name ASC
    `);
    res.json({ success: true, departments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW DEPARTMENT
router.post('/', async (req, res) => {
  const { name, college_id, semester_count, is_active } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO departments (name, college_id, semester_count, is_active) VALUES (?, ?, ?, ?)',
      [name, college_id, semester_count || 6, is_active !== undefined ? is_active : true]
    );
    res.json({ success: true, message: 'Department added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE DEPARTMENT
router.put('/:id', async (req, res) => {
  const { name, college_id, semester_count, is_active } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE departments SET name=?, college_id=?, semester_count=?, is_active=? WHERE id=?',
      [name, college_id, semester_count, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Department updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE DEPARTMENT
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM departments WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;