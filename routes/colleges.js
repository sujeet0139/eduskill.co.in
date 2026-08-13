const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');
const { resolveStateId } = require('../lib/states');

const logoUpload = makeUpload({
  folder: 'eduskill/college-logos',
  prefix: 'logo-',
  maxSize: 2 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp|svg/,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
});

// GET ALL COLLEGES
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [colleges] = await connection.query(`
      SELECT c.*, d.name as district_name, u.name as university_name
      FROM colleges c
      LEFT JOIN districts d ON c.district_id = d.id
      LEFT JOIN universities u ON c.university_id = u.id
      ORDER BY c.name ASC
    `);
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET COLLEGE BY ID (includes HODs)
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [colleges] = await connection.query('SELECT * FROM colleges WHERE id = ?', [req.params.id]);
    if (colleges.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }
    const [hods] = await connection.query('SELECT * FROM college_hods WHERE college_id = ? ORDER BY name', [req.params.id]);
    res.json({ success: true, college: { ...colleges[0], hods } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// CREATE NEW COLLEGE
router.post('/', async (req, res) => {
  const { name, college_code, district_id, state, address, contact_no, principal_details, university_id, website, logo_url, principal_name, principal_phone } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const stateName = state || 'Bihar';
    const stateId = await resolveStateId(connection, stateName);
    await connection.query(
      `INSERT INTO colleges (name, college_code, district_id, state, state_id, address, contact_no, principal_details, university_id, website, logo_url, principal_name, principal_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, college_code, district_id || null, stateName, stateId, address, contact_no, principal_details,
       university_id || null, website || null, logo_url || null, principal_name || null, principal_phone || null]
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
  const { name, college_code, district_id, state, address, contact_no, principal_details, university_id, website, logo_url, principal_name, principal_phone } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    // Only fall back to 'Bihar' on CREATE. On UPDATE, a caller that omits
    // `state` (an older cached frontend bundle mid-deploy, a script, a
    // direct API call) must not silently blow away a college's real,
    // already-correct state -- so fall back to the existing value instead.
    const [[existing]] = await connection.query('SELECT state FROM colleges WHERE id = ?', [req.params.id]);
    const stateName = state || existing?.state || 'Bihar';
    const stateId = await resolveStateId(connection, stateName);
    await connection.query(
      `UPDATE colleges SET name=?, college_code=?, district_id=?, state=?, state_id=?, address=?, contact_no=?, principal_details=?,
       university_id=?, website=?, logo_url=?, principal_name=?, principal_phone=? WHERE id=?`,
      [name, college_code, district_id || null, stateName, stateId, address, contact_no, principal_details,
       university_id || null, website || null, logo_url || null, principal_name || null, principal_phone || null, req.params.id]
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

// UPLOAD COLLEGE LOGO -> returns the public URL to save on the college record
router.post('/upload-logo', logoUpload.single('logo'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'Logo file is required.' });
  res.json({ success: true, url });
});

// HOD DETAILS (dev-prompt item #23 -- "support multiple")
router.post('/:id/hods', async (req, res) => {
  const { name, department, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO college_hods (college_id, name, department, phone, email) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, name, department || null, phone || null, email || null]
    );
    res.status(201).json({ success: true, message: 'HOD added.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id/hods/:hodId', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM college_hods WHERE id = ? AND college_id = ?', [req.params.hodId, req.params.id]);
    res.json({ success: true, message: 'HOD removed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
