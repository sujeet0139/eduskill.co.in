const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL COLLEGES
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [colleges] = await connection.query('SELECT * FROM colleges ORDER BY name ASC');
    connection.release();
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW COLLEGE
router.post('/', async (req, res) => {
  const { name, district, state } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO colleges (name, district, state) VALUES (?, ?, ?)',
      [name, district, state || 'Bihar']
    );
    connection.release();
    res.json({ success: true, message: 'College added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE COLLEGE
router.put('/:id', async (req, res) => {
  const { name, district, state } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE colleges SET name=?, district=?, state=? WHERE id=?',
      [name, district, state, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'College updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE COLLEGE
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM colleges WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'College deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;