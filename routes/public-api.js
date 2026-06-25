const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/public/hero-slides - Fetch active slides for the homepage carousel
router.get('/hero-slides', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [slides] = await connection.query(
      'SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY order_no ASC, id ASC'
    );
    connection.release();
    res.json({ success: true, slides });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slides', details: error.message });
  }
});

module.exports = router;