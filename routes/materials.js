const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');

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
router.post('/upload', upload.single('document'), async (req, res) => {
  const { title, description } = req.body;
  const filePath = fileUrl(req.file);

  try {
    if (!title || !filePath) return res.status(400).json({ error: 'Title and document are required' });

    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO study_materials (title, description, file_path) VALUES (?, ?, ?)',
      [title, description, filePath]
    );
    connection.release();

    res.json({ success: true, message: 'Study material uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// PUBLIC/STUDENT: GET ALL STUDY MATERIALS
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

// ADMIN: GENERATE CONSENT LETTER (Stub for future frontend integration)
router.post('/consent-letter', async (req, res) => {
  const { studentId, collegeId } = req.body;
  // Logic to dynamically generate a PDF or HTML template for a consent letter goes here.
  // For now, we return a success response to the admin panel.
  res.json({ success: true, message: 'Consent letter issued', data: { studentId, collegeId, date: new Date() } });
});

module.exports = router;