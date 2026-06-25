const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL DISTRICTS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [districts] = await connection.query(`
      SELECT d.*, 
             (SELECT COUNT(*) FROM colleges WHERE district_id = d.id) as total_colleges 
      FROM districts d 
      ORDER BY d.name ASC
    `);
    connection.release();
    res.json({ success: true, districts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET COLLEGES BY DISTRICT ID
router.get('/:id/colleges', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [colleges] = await connection.query('SELECT * FROM colleges WHERE district_id = ? ORDER BY name ASC', [req.params.id]);
    connection.release();
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW DISTRICT
router.post('/', async (req, res) => {
  const { name, code } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO districts (name, code) VALUES (?, ?)',
      [name, code]
    );
    connection.release();
    res.json({ success: true, message: 'District added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE DISTRICT
router.put('/:id', async (req, res) => {
  const { name, code } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE districts SET name=?, code=? WHERE id=?',
      [name, code, req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'District updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE DISTRICT
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM districts WHERE id=?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'District deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;