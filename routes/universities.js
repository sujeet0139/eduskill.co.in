const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/authMiddleware');

// Affiliated universities master list (dev-prompt item #23's "Affiliated
// University (dropdown)"). Completed per master-dev-prompt Section C#3 --
// was name-only with GET/POST only, no PUT/DELETE, and no admin screen
// existed to manage it (colleges only ever read the list for a dropdown).
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
  const { name, short_code, state, website, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO universities (name, short_code, state, website, logo_url) VALUES (?, ?, ?, ?, ?)',
      [name, short_code || null, state || null, website || null, logo_url || null]
    );
    res.json({ success: true, message: 'University added.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A university with that name already exists.' });
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name, short_code, state, website, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE universities SET name=?, short_code=?, state=?, website=?, logo_url=? WHERE id=?',
      [name, short_code || null, state || null, website || null, logo_url || null, req.params.id]
    );
    res.json({ success: true, message: 'University updated.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A university with that name already exists.' });
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM universities WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'University deleted.' });
  } catch (error) {
    // Referenced by colleges.university_id (ON DELETE SET NULL) so this
    // shouldn't actually fail on FK grounds -- but report clearly if it does.
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
