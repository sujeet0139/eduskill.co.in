const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');

// Signature / logo / seal image uploads (2 MB).
const upload = makeUpload({
  folder: 'eduskill/certificates',
  prefix: 'cert-asset-',
  maxSize: 2 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp/,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
});

const FIELDS = [
  'name', 'heading', 'body', 'logo_url', 'seal_url', 'accent_color',
  'sig1_name', 'sig1_title', 'sig1_image',
  'sig2_name', 'sig2_title', 'sig2_image',
  'sig3_name', 'sig3_title', 'sig3_image',
  'course_id', 'program_id', 'is_default',
];

// Resolve which template applies to a certificate (course/program → else default).
// Exported so routes/certificates.js can stamp template_id at issue time.
async function resolveTemplateId(connection, { course_id, program_id }) {
  try {
    if (course_id) {
      const [[byCourse]] = await connection.query('SELECT id FROM certificate_templates WHERE course_id = ? LIMIT 1', [course_id]);
      if (byCourse) return byCourse.id;
    }
    if (program_id) {
      const [[byProgram]] = await connection.query('SELECT id FROM certificate_templates WHERE program_id = ? LIMIT 1', [program_id]);
      if (byProgram) return byProgram.id;
    }
    const [[def]] = await connection.query('SELECT id FROM certificate_templates WHERE is_default = 1 ORDER BY id LIMIT 1');
    return def ? def.id : null;
  } catch (e) {
    // Templates table not migrated yet — issue the certificate with the built-in design.
    return null;
  }
}

// LIST templates (with mapped course/program titles).
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [templates] = await connection.query(`
      SELECT t.*, c.title AS course_title, p.title AS program_title
      FROM certificate_templates t
      LEFT JOIN courses c ON t.course_id = c.id
      LEFT JOIN programs p ON t.program_id = p.id
      ORDER BY t.is_default DESC, t.created_at DESC
    `);
    connection.release();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPLOAD a signature/logo/seal image → returns its URL.
router.post('/upload', upload.single('image'), async (req, res) => {
  const url = fileUrl(req.file);
  if (!url) return res.status(400).json({ error: 'Image file is required.' });
  res.json({ success: true, url });
});

function pickFields(body) {
  const out = {};
  for (const f of FIELDS) {
    if (f === 'course_id' || f === 'program_id') out[f] = body[f] || null;
    else if (f === 'is_default') out[f] = body[f] ? 1 : 0;
    else out[f] = body[f] ?? null;
  }
  return out;
}

// If this template is being set as default, clear the flag on others.
async function clearOtherDefaults(connection, exceptId) {
  await connection.query('UPDATE certificate_templates SET is_default = 0 WHERE id <> ?', [exceptId || 0]);
}

// CREATE
router.post('/', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Template name is required.' });
  const data = pickFields(req.body);
  let connection;
  try {
    connection = await pool.getConnection();
    const cols = Object.keys(data);
    const [result] = await connection.query(
      `INSERT INTO certificate_templates (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((c) => data[c])
    );
    if (data.is_default) await clearOtherDefaults(connection, result.insertId);
    connection.release();
    res.json({ success: true, message: 'Template created', id: result.insertId });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const data = pickFields(req.body);
  let connection;
  try {
    connection = await pool.getConnection();
    const cols = Object.keys(data);
    await connection.query(
      `UPDATE certificate_templates SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...cols.map((c) => data[c]), req.params.id]
    );
    if (data.is_default) await clearOtherDefaults(connection, req.params.id);
    connection.release();
    res.json({ success: true, message: 'Template updated' });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM certificate_templates WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.resolveTemplateId = resolveTemplateId;
