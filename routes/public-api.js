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

// Helper: read a whitelisted set of settings as a key/value object.
async function readSettings(keys) {
  const connection = await pool.getConnection();
  const [rows] = await connection.query(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
    keys
  );
  connection.release();
  return rows.reduce((acc, r) => { acc[r.setting_key] = r.setting_value; return acc; }, {});
}

// GET /api/public/payment-info - UPI ID, QR image and bank details for the student pay screen
router.get('/payment-info', async (req, res) => {
  try {
    const s = await readSettings(['payment_upi_id', 'payment_upi_qr_url', 'payment_bank_details', 'institute_name']);
    res.json({ success: true, payment: s });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment info', details: error.message });
  }
});

// GET /api/public/site-info - public institute + social links for header/footer
router.get('/site-info', async (req, res) => {
  try {
    const s = await readSettings([
      'institute_name', 'institute_email', 'institute_phone', 'institute_address', 'institute_website',
      'social_facebook', 'social_instagram', 'social_youtube', 'social_linkedin', 'social_whatsapp', 'social_twitter',
    ]);
    res.json({ success: true, site: s });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site info', details: error.message });
  }
});


module.exports = router;