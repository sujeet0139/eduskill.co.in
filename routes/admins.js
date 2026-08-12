const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/authMiddleware');

// GET ALL ADMINS
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [admins] = await connection.query('SELECT id, name, email, role, is_active, created_at FROM admin_users ORDER BY created_at DESC');
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW ADMIN
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;
  let connection;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role || 'moderator']
    );
    res.json({ success: true, message: 'Admin user added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE ADMIN (Activate / Deactivate / Change Role)
router.put('/:id', async (req, res) => {
  const { name, email, role, is_active } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE admin_users SET name=?, email=?, role=?, is_active=? WHERE id=?', [name, email, role, is_active ? 1 : 0, req.params.id]);
    res.json({ success: true, message: 'Admin user updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// SET / UPDATE AN ADMIN'S PASSWORD
router.put('/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [[admin]] = await connection.query('SELECT id FROM admin_users WHERE id = ?', [req.params.id]);
    if (!admin) { return res.status(404).json({ error: 'Admin not found.' }); }
    const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    await connection.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ success: true, message: 'Admin password updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;