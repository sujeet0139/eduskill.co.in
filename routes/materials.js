const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');
const { requireAdmin } = require('../middleware/authMiddleware');

// Study-material uploads (image/PDF/Word, 10 MB). Cloudinary in production,
// local disk in development. See config/storage.js.
const upload = makeUpload({
  folder: 'eduskill/materials',
  prefix: 'material-',
  maxSize: 10 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|pdf|doc|docx/,
  allowedMime: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
});

// ADMIN: UPLOAD STUDY MATERIAL
router.post('/upload', requireAdmin, upload.single('document'), async (req, res) => {
  const { title, description, category } = req.body;
  const filePath = fileUrl(req.file);

  try {
    if (!title || !filePath) return res.status(400).json({ error: 'Title and document are required' });

    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO study_materials (title, description, category, file_path) VALUES (?, ?, ?, ?)',
      [title, description || null, category || null, filePath]
    );
    connection.release();

    res.json({ success: true, message: 'Study material uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// PUBLIC/STUDENT: GET ACTIVE STUDY MATERIALS
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [materials] = await connection.query('SELECT * FROM study_materials WHERE is_active = TRUE ORDER BY created_at DESC');
    connection.release();
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: GET ALL STUDY MATERIALS (including disabled)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [materials] = await connection.query('SELECT * FROM study_materials ORDER BY created_at DESC');
    connection.release();
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: TOGGLE ACTIVE / UPDATE METADATA
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, description, category, is_active } = req.body;
  try {
    const connection = await pool.getConnection();
    const [[existing]] = await connection.query('SELECT * FROM study_materials WHERE id = ?', [req.params.id]);
    if (!existing) {
      connection.release();
      return res.status(404).json({ error: 'Material not found' });
    }
    await connection.query(
      'UPDATE study_materials SET title = ?, description = ?, category = ?, is_active = ? WHERE id = ?',
      [
        title ?? existing.title,
        description ?? existing.description,
        category ?? existing.category,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        req.params.id,
      ]
    );
    connection.release();
    res.json({ success: true, message: 'Study material updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: DELETE STUDY MATERIAL
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('DELETE FROM study_materials WHERE id = ?', [req.params.id]);
    connection.release();
    res.json({ success: true, message: 'Study material deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: GENERATE CONSENT LETTER (Stub for future frontend integration)
router.post('/consent-letter', requireAdmin, async (req, res) => {
  const { studentId, collegeId } = req.body;
  res.json({ success: true, message: 'Consent letter issued', data: { studentId, collegeId, date: new Date() } });
});

module.exports = router;
