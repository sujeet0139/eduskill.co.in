const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL COLLEGES
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [colleges] = await connection.query(`
      SELECT c.*, d.name as district_name
      FROM colleges c
      LEFT JOIN districts d ON c.district_id = d.id
      ORDER BY c.name ASC
    `);
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET COLLEGE BY ID
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [colleges] = await connection.query('SELECT * FROM colleges WHERE id = ?', [req.params.id]);
    if (colleges.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }
    res.json({ success: true, college: colleges[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW COLLEGE
router.post('/', async (req, res) => {
  const { name, college_code, district_id, state, address, contact_no, principal_details } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO colleges (name, college_code, district_id, state, address, contact_no, principal_details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, college_code, district_id || null, state || 'Bihar', address, contact_no, principal_details]
    );
    res.json({ success: true, message: 'College added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE COLLEGE
router.put('/:id', async (req, res) => {
  const { name, college_code, district_id, state, address, contact_no, principal_details } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE colleges SET name=?, college_code=?, district_id=?, state=?, address=?, contact_no=?, principal_details=? WHERE id=?',
      [name, college_code, district_id || null, state, address, contact_no, principal_details, req.params.id]
    );
    res.json({ success: true, message: 'College updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE COLLEGE
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM colleges WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'College deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;