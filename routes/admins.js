const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// GET ALL ADMINS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [admins] = await connection.query('SELECT id, name, email, role, is_active, created_at FROM admin_users ORDER BY created_at DESC');
    connection.release();
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW ADMIN
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 
      [name, email, hash, role || 'moderator']
    );
    connection.release();
    res.json({ success: true, message: 'Admin user added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE ADMIN (Activate / Deactivate / Change Role)
router.put('/:id', async (req, res) => {
  const { name, email, role, is_active } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE admin_users SET name=?, email=?, role=?, is_active=? WHERE id=?', [name, email, role, is_active ? 1 : 0, req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Admin user updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;