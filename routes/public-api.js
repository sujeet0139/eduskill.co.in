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

// GET /api/public/registration-form - Fetch enabled fields for the student registration form
router.get('/registration-form', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    // Select only the necessary fields to expose publicly
    const [fields] = await connection.query(
      "SELECT field_name, label, type, is_mandatory, options FROM registration_fields WHERE is_enabled = TRUE ORDER BY order_no ASC"
    );
    connection.release();
    res.json({ success: true, fields });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch form configuration', details: error.message });
  }
});

// GET /api/public/colleges - Fetch all colleges for dropdowns
router.get('/colleges', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [colleges] = await connection.query('SELECT id, name FROM colleges ORDER BY name ASC');
    connection.release();
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch colleges', details: error.message });
  }
});


module.exports = router;