const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/public/hero-slides - Fetch active slides for the homepage carousel
router.get('/hero-slides', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [slides] = await connection.query(
      'SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY order_no ASC, id ASC'
    );
    res.json({ success: true, slides });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slides', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/public/registration-form - Fetch enabled fields for the student registration form
router.get('/registration-form', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // Select only the necessary fields to expose publicly
    const [fields] = await connection.query(
      "SELECT field_name, label, type, is_mandatory, options FROM registration_fields WHERE is_enabled = TRUE ORDER BY order_no ASC"
    );
    res.json({ success: true, fields });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch form configuration', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/public/colleges - Fetch colleges for dropdowns + homepage list.
// Optional ?districtId= narrows the list, for the State -> District ->
// College cascade on the registration form (dev-prompt item #23).
router.get('/colleges', async (req, res) => {
  const { districtId } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    const params = [];
    let query = `
      SELECT c.id, c.name, d.name AS district
      FROM colleges c LEFT JOIN districts d ON c.district_id = d.id
      WHERE 1=1
    `;
    if (districtId) { query += ' AND c.district_id = ?'; params.push(districtId); }
    query += ' ORDER BY c.name ASC';
    const [colleges] = await connection.query(query, params);
    res.json({ success: true, colleges });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch colleges', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/public/states - distinct states with a district, for the
// State -> District cascade (item #23). Read-only, no PII, safe public.
router.get('/states', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT DISTINCT state FROM districts ORDER BY state ASC');
    res.json({ success: true, states: rows.map((r) => r.state) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch states', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/public/districts - optionally filtered by ?state=
router.get('/districts', async (req, res) => {
  const { state } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    const [districts] = state
      ? await connection.query('SELECT id, name, state FROM districts WHERE state = ? ORDER BY name ASC', [state])
      : await connection.query('SELECT id, name, state FROM districts ORDER BY name ASC');
    res.json({ success: true, districts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch districts', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/public/courses - Published courses for the homepage / catalog
router.get('/courses', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [courses] = await connection.query(
      `SELECT id, title, category, subject, description, duration_weeks, price, language, level
       FROM courses WHERE status = 'published' ORDER BY created_at DESC`
    );
    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Helper: read a whitelisted set of settings as a key/value object.
async function readSettings(keys) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
      keys
    );
    return rows.reduce((acc, r) => { acc[r.setting_key] = r.setting_value; return acc; }, {});
  } finally {
    if (connection) connection.release();
  }
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

// GET /api/public/stats - real counts for the homepage (students, colleges, courses, certificates)
router.get('/stats', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const safeCount = async (sql) => {
      try { const [[r]] = await connection.query(sql); return r.c; } catch { return 0; }
    };
    const stats = {
      students: await safeCount('SELECT COUNT(*) c FROM students'),
      colleges: await safeCount('SELECT COUNT(*) c FROM colleges'),
      courses: await safeCount("SELECT COUNT(*) c FROM courses WHERE status = 'active'"),
      programs: await safeCount("SELECT COUNT(*) c FROM programs WHERE status = 'active'"),
      certificates: await safeCount("SELECT COUNT(*) c FROM certificates WHERE status = 'active'"),
    };
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/public/announcements - latest sent announcements for the ticker
router.get('/announcements', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [announcements] = await connection.query(
      "SELECT title, message, created_at FROM announcements WHERE status = 'sent' ORDER BY created_at DESC LIMIT 8"
    );
    res.json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements', details: error.message });
  } finally {
    if (connection) connection.release();
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