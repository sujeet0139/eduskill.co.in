const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL ANNOUNCEMENTS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [announcements] = await connection.query('SELECT * FROM announcements ORDER BY created_at DESC');
    connection.release();
    res.json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE NEW ANNOUNCEMENT
router.post('/', async (req, res) => {
  const { title, message, target_type, target_id, send_email, scheduled_at } = req.body;
  try {
    const connection = await pool.getConnection();
    const status = scheduled_at ? 'scheduled' : 'sent'; // Simplistic status handling
    
    await connection.query(
      `INSERT INTO announcements (title, message, target_type, target_id, send_email, scheduled_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, message, target_type || 'all', target_id || null, send_email ? 1 : 0, scheduled_at || null, status]
    );
    connection.release();
    
    // Note: Actual email dispatch logic for "send_email = true" would typically hook into Nodemailer here 
    // or run via a background cron job for scheduled messages.
    
    res.json({ success: true, message: 'Announcement created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RESEND ANNOUNCEMENT
router.post('/:id/resend', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    // Just updating status to 'sent' and modifying timestamp for MVP purposes
    await connection.query(
      'UPDATE announcements SET status = "sent", created_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [req.params.id]
    );
    connection.release();
    res.json({ success: true, message: 'Announcement resent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;