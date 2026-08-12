const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/authMiddleware');

// Affiliated universities master list (dev-prompt item #23's "Affiliated
// University (dropdown)"). Deliberately tiny -- a name and nothing else --
// since nothing downstream needs more than that yet.
router.get('/', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [universities] = await connection.query('SELECT * FROM universities ORDER BY name ASC');
    res.json({ success: true, universities });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('INSERT IGNORE INTO universities (name) VALUES (?)', [name]);
    res.json({ success: true, message: 'University added.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
