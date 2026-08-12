const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { makeUpload, fileUrl } = require('../config/storage');

// Configure upload for hero images (up to 2MB)
const upload = makeUpload({
  folder: 'eduskill/hero',
  prefix: 'hero-slide-',
  maxSize: 2 * 1024 * 1024,
  allowedExt: /jpeg|jpg|png|webp/,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp']
});

// GET all slides (for admin panel)
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [slides] = await connection.query('SELECT * FROM hero_slides ORDER BY order_no ASC, id ASC');
    res.json({ success: true, slides });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST a new slide (with image upload)
router.post('/', upload.single('image'), async (req, res) => {
  const { alt_text, title, subtitle, cta_text, cta_link, is_active, order_no } = req.body;
  const imageUrl = fileUrl(req.file);

  if (!imageUrl) {
    return res.status(400).json({ error: 'Image file is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO hero_slides (image_url, alt_text, title, subtitle, cta_text, cta_link, is_active, order_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [imageUrl, alt_text, title, subtitle, cta_text, cta_link, is_active === 'true', order_no || 0]
    );
    res.status(201).json({ success: true, message: 'Slide created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// PUT (update) a slide
router.put('/:id', upload.single('image'), async (req, res) => {
  const { alt_text, title, subtitle, cta_text, cta_link, is_active, order_no } = req.body;
  const newImageUrl = fileUrl(req.file);

  let connection;
  try {
    connection = await pool.getConnection();

    // If a new image is uploaded, include it in the update.
    // Otherwise, keep the existing image.
    let query = `UPDATE hero_slides SET alt_text=?, title=?, subtitle=?, cta_text=?, cta_link=?, is_active=?, order_no=?`;
    const params = [alt_text, title, subtitle, cta_text, cta_link, is_active === 'true', order_no || 0];

    if (newImageUrl) {
      query += `, image_url=?`;
      params.push(newImageUrl);
      // Note: In a production system, you would also delete the OLD image from Cloudinary here.
    }

    query += ` WHERE id=?`;
    params.push(req.params.id);

    await connection.query(query, params);

    res.json({ success: true, message: 'Slide updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE a slide
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // Note: This doesn't delete the image from Cloudinary/disk, only the DB record.
    // A more robust implementation would also delete the file from storage.
    await connection.query('DELETE FROM hero_slides WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Slide deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;