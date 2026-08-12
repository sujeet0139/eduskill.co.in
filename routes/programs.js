const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/authMiddleware');

// GET ALL PROGRAMS
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [programs] = await connection.query('SELECT * FROM programs ORDER BY created_at DESC');
    res.json({ success: true, programs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW PROGRAM
router.post('/', requireAdmin, async (req, res) => {
  const { title, description, duration_weeks, fee, start_date, end_date, max_enrollment, status } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO programs (title, description, duration_weeks, fee, start_date, end_date, max_enrollment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, duration_weeks, fee, start_date || null, end_date || null, max_enrollment, status || 'draft']
    );
    res.json({ success: true, message: 'Program created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// UPDATE PROGRAM
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, description, duration_weeks, fee, start_date, end_date, max_enrollment, status } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE programs SET title=?, description=?, duration_weeks=?, fee=?, start_date=?, end_date=?, max_enrollment=?, status=? WHERE id=?`,
      [title, description, duration_weeks, fee, start_date || null, end_date || null, max_enrollment, status, req.params.id]
    );
    res.json({ success: true, message: 'Program updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE PROGRAM
router.delete('/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Program -> Track (Major/Minor) -> Course hierarchy (dev-prompt item #14).
// A program has at most one "major" and one "minor" track (enforced by the
// unique_program_track key in check-db.js); courses are then classified into
// a track via courses.track_id.
router.get('/:id/tracks', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [tracks] = await connection.query(
      `SELECT t.*, (SELECT COUNT(*) FROM courses c WHERE c.track_id = t.id) as course_count
       FROM tracks t WHERE t.program_id = ? ORDER BY t.name`, [req.params.id]);
    res.json({ success: true, tracks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/tracks', requireAdmin, async (req, res) => {
  const { name, label } = req.body;
  if (!['major', 'minor'].includes(name)) {
    return res.status(400).json({ error: "name must be 'major' or 'minor'." });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO tracks (program_id, name, label) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [req.params.id, name, label || null]
    );
    res.json({ success: true, message: 'Track saved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;