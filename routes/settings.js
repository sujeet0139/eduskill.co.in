const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL SETTINGS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT setting_key, setting_value FROM settings');
    connection.release();
    
    // Convert array of rows into a single key-value object
    const settings = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BULK UPDATE SETTINGS
router.put('/', async (req, res) => {
  const settingsToUpdate = req.body;
  try {
    const connection = await pool.getConnection();
    
    // Upsert each setting
    for (const [key, value] of Object.entries(settingsToUpdate)) {
      await connection.query(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, value, value]
      );
    }
    
    connection.release();
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;