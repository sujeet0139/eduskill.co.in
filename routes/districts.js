const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL DISTRICTS (optionally ?state= for the State -> District cascade)
router.get('/', async (req, res) => {
  const { state } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    const params = [];
    let query = `
      SELECT d.*,
             (SELECT COUNT(*) FROM colleges WHERE district_id = d.id) as total_colleges
      FROM districts d
      WHERE 1=1
    `;
    if (state) { query += ' AND d.state = ?'; params.push(state); }
    query += ' ORDER BY d.name ASC';
    const [districts] = await connection.query(query, params);
    res.json({ success: true, districts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET distinct states -- for the State dropdown itself.
router.get('/states', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT DISTINCT state FROM districts ORDER BY state ASC');
    res.json({ success: true, states: rows.map((r) => r.state) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET COLLEGES BY DISTRICT ID
router.get('/:id/colleges', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [colleges] = await connection.query('SELECT * FROM colleges WHERE district_id = ? ORDER BY name ASC', [req.params.id]);
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW DISTRICT
router.post('/', async (req, res) => {
  const { name, code } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO districts (name, code) VALUES (?, ?)',
      [name, code]
    );
    res.json({ success: true, message: 'District added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE DISTRICT
router.put('/:id', async (req, res) => {
  const { name, code } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE districts SET name=?, code=? WHERE id=?',
      [name, code, req.params.id]
    );
    res.json({ success: true, message: 'District updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE DISTRICT
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM districts WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'District deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;