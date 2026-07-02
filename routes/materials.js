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

// ADMIN: UPLOAD STUDY MATERIAL (optionally tagged to a course / program / subject)
router.post('/upload', requireAdmin, upload.single('document'), async (req, res) => {
  const { title, description, category, course_id, program_id, subject } = req.body;
  const filePath = fileUrl(req.file);

  try {
    if (!title || !filePath) return res.status(400).json({ error: 'Title and document are required' });

    const connection = await pool.getConnection();
    await connection.query(
      'INSERT INTO study_materials (title, description, category, course_id, program_id, subject, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description || null, category || null, course_id || null, program_id || null, subject || null, filePath]
    );
    connection.release();

    res.json({ success: true, message: 'Study material uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Build a SELECT that joins course/program titles + supports filters.
function materialsQuery(extraWhere = '', activeOnly = true) {
  return `SELECT m.*, c.title AS course_title, p.title AS program_title
          FROM study_materials m
          LEFT JOIN courses c ON m.course_id = c.id
          LEFT JOIN programs p ON m.program_id = p.id
          WHERE 1=1 ${activeOnly ? 'AND m.is_active = TRUE' : ''} ${extraWhere}
          ORDER BY m.created_at DESC`;
}

// PUBLIC: GET ACTIVE *GENERAL* STUDY MATERIALS (untagged). Course/program-tagged
// materials are private to enrolled students (served by /api/student-dashboard/materials).
router.get('/', async (req, res) => {
  const { subject } = req.query;
  const where = ['AND m.course_id IS NULL AND m.program_id IS NULL'];
  const params = [];
  if (subject) { where.push('AND m.subject = ?'); params.push(subject); }
  try {
    const connection = await pool.getConnection();
    const [materials] = await connection.query(materialsQuery(where.join(' ')), params);
    connection.release();
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: GET ALL STUDY MATERIALS (including disabled), with course/program titles
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [materials] = await connection.query(materialsQuery('', false));
    connection.release();
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN: TOGGLE ACTIVE / UPDATE METADATA
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, description, category, is_active, course_id, program_id, subject } = req.body;
  try {
    const connection = await pool.getConnection();
    const [[existing]] = await connection.query('SELECT * FROM study_materials WHERE id = ?', [req.params.id]);
    if (!existing) {
      connection.release();
      return res.status(404).json({ error: 'Material not found' });
    }
    await connection.query(
      'UPDATE study_materials SET title = ?, description = ?, category = ?, course_id = ?, program_id = ?, subject = ?, is_active = ? WHERE id = ?',
      [
        title ?? existing.title,
        description ?? existing.description,
        category ?? existing.category,
        course_id !== undefined ? (course_id || null) : existing.course_id,
        program_id !== undefined ? (program_id || null) : existing.program_id,
        subject !== undefined ? (subject || null) : existing.subject,
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
