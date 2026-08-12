const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET ALL ANNOUNCEMENTS
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [announcements] = await connection.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW ANNOUNCEMENT
router.post('/', async (req, res) => {
  const { title, message, target_type, target_id, send_email, scheduled_at } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const status = scheduled_at ? 'scheduled' : 'sent'; // Simplistic status handling

    await connection.query(
      `INSERT INTO announcements (title, message, target_type, target_id, send_email, scheduled_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, message, target_type || 'all', target_id || null, send_email ? 1 : 0, scheduled_at || null, status]
    );

    // Note: Actual email dispatch logic for "send_email = true" would typically hook into Nodemailer here
    // or run via a background cron job for scheduled messages.

    res.json({ success: true, message: 'Announcement created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// RESEND ANNOUNCEMENT
router.post('/:id/resend', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // Just updating status to 'sent' and modifying timestamp for MVP purposes
    await connection.query(
      'UPDATE announcements SET status = "sent", created_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true, message: 'Announcement resent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;