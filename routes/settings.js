const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');

const qrUpload = makeUpload({
  folder: 'eduskill/settings',
  prefix: 'qr-',
  maxSize: 2 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp/,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
});

// UPLOAD UPI QR CODE IMAGE -> saves the public URL into payment_upi_qr_url
router.post('/upload-qr', qrUpload.single('qr'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'QR image file is required.' });
  try {
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES ('payment_upi_qr_url', ?)
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [url, url]
    );
    connection.release();
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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