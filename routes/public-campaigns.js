const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { validateStudentFields, normalizeMobile } = require('../lib/validators');
const { logRegistrationFailure } = require('../lib/failureLog');
const { notifyStudent } = require('../lib/notify');
const { sendWelcomeEmail } = require('../email');

// Public, unauthenticated routes backing the student-facing campaign flow
// (frontend/app/c/[slug]). No admin auth here by design -- this is the
// whole point of a shareable link.

function campaignState(campaign) {
  if (campaign.status === 'paused') return 'paused';
  const now = Date.now();
  if (campaign.starts_at && now < new Date(campaign.starts_at).getTime()) return 'not_started';
  if (campaign.ends_at && now > new Date(campaign.ends_at).getTime()) return 'expired';
  return 'active';
}

// GET the campaign's public content. Increments the link-open hit counter
// (item 5's "lightweight hit counter on page load, not full analytics").
router.get('/:slug', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query(`
      SELECT c.*, co.name AS college_name, p.title AS program_title, cs.title AS course_title, b.name AS batch_name, b.start_date AS batch_start_date
      FROM campaigns c
      LEFT JOIN colleges co ON c.college_id = co.id
      LEFT JOIN programs p ON c.program_id = p.id
      LEFT JOIN courses cs ON c.course_id = cs.id
      LEFT JOIN batches b ON c.batch_id = b.id
      WHERE c.slug = ?
    `, [req.params.slug]);
    if (!campaign) return res.status(404).json({ error: 'This link does not exist.' });

    const state = campaignState(campaign);
    if (state !== 'active') {
      return res.json({ success: true, state, campaign: { name: campaign.name } });
    }

    // Fire-and-forget-ish: a miscount here must never break the page.
    connection.query('UPDATE campaigns SET view_count = view_count + 1 WHERE id = ?', [campaign.id]).catch(() => {});

    const [benefits] = await connection.query('SELECT icon, title, description FROM campaign_benefits WHERE campaign_id = ? ORDER BY order_no', [campaign.id]);
    const [interests] = await connection.query('SELECT label FROM campaign_interests WHERE campaign_id = ? ORDER BY order_no', [campaign.id]);

    res.json({
      success: true,
      state: 'active',
      campaign: {
        id: campaign.id, slug: campaign.slug, name: campaign.name,
        hero_tag: campaign.hero_tag, headline: campaign.headline, subheading: campaign.subheading,
        feedback_enabled: !!campaign.feedback_enabled, counselor_toggle_enabled: !!campaign.counselor_toggle_enabled,
        confirmation_template: campaign.confirmation_template, group_link: campaign.group_link,
        college_name: campaign.college_name, program_title: campaign.program_title,
        course_title: campaign.course_title, batch_name: campaign.batch_name,
        batch_start_date: campaign.batch_start_date,
        benefits, interests: interests.map((i) => i.label),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Lightweight ping when the student reaches the registration form (Step 2)
// -- separates "opened the link" from "actually started filling the form"
// in the funnel, per item 5.
router.post('/:slug/start', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE campaigns SET registration_starts_count = registration_starts_count + 1 WHERE slug = ?', [req.params.slug]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Register through a campaign. Same validation as the main /api/students/
// register, plus: college/program/course/batch come from the CAMPAIGN, not
// the student (that's the whole point of a pre-filled link) -- and this
// creates a real `students` row + a normal student_courses/student_programs
// mapping, not a separate campaign-only record, so it flows into the same
// Guest/Enrolled and mapping systems as any other registration.
router.post('/:slug/register', async (req, res) => {
  const studentData = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query('SELECT * FROM campaigns WHERE slug = ?', [req.params.slug]);
    if (!campaign) return res.status(404).json({ error: 'This link does not exist.' });
    if (campaignState(campaign) !== 'active') {
      return res.status(400).json({ error: 'This registration link is no longer accepting new registrations.' });
    }

    if (!studentData.name || !studentData.email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const fmtErr = validateStudentFields(studentData);
    if (fmtErr) return res.status(400).json({ error: fmtErr });
    const normPhone = studentData.phone ? normalizeMobile(studentData.phone) : null;

    const [[existingEmail]] = await connection.query('SELECT id FROM students WHERE email = ?', [studentData.email]);
    if (existingEmail) return res.status(400).json({ error: 'Email already registered.' });
    if (normPhone) {
      const [[existingPhone]] = await connection.query('SELECT id FROM students WHERE phone = ?', [normPhone]);
      if (existingPhone) return res.status(400).json({ error: 'This mobile/WhatsApp number is already registered.' });
    }

    const currentYear = new Date().getFullYear().toString().slice(-2);
    const [[lastStudent]] = await connection.query('SELECT id FROM students ORDER BY id DESC LIMIT 1');
    const nextId = (lastStudent ? lastStudent.id : 0) + 1;
    const enrollmentId = `ENR${currentYear}${String(nextId).padStart(4, '0')}`;
    const referenceNo = 'SKC' + Date.now();
    const tempPassword = studentData.password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));

    const [result] = await connection.query(
      `INSERT INTO students (enrollment_id, reference_no, name, email, password_hash, phone, college_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'registered')`,
      [enrollmentId, referenceNo, studentData.name, studentData.email, passwordHash, normPhone, campaign.college_id || null]
    );
    const studentId = result.insertId;

    // Map into the campaign's target course/program, same as an admin
    // directly mapping a student -- an assigned roster entry, not a
    // payment-confirmed enrollment (enrollment_status stays 'guest' until
    // an actual payment happens, same rule as everywhere else this session).
    if (campaign.course_id) {
      await connection.query(
        'INSERT INTO student_courses (student_id, course_id, batch_id, status) VALUES (?, ?, ?, "enrolled") ON DUPLICATE KEY UPDATE batch_id = VALUES(batch_id)',
        [studentId, campaign.course_id, campaign.batch_id || null]
      );
    }
    if (campaign.program_id) {
      await connection.query(
        'INSERT INTO student_programs (student_id, program_id, batch_id, status) VALUES (?, ?, ?, "enrolled") ON DUPLICATE KEY UPDATE batch_id = VALUES(batch_id)',
        [studentId, campaign.program_id, campaign.batch_id || null]
      );
    }

    await connection.query('INSERT INTO campaign_registrations (campaign_id, student_id) VALUES (?, ?)', [campaign.id, studentId]);

    // Fire-and-forget, same lesson as dev-prompt item #1 -- never let
    // delivery delay the response.
    sendWelcomeEmail(studentData.email, studentData.name, referenceNo).catch((e) => console.error('Campaign welcome email failed:', e.message));
    notifyStudent(normPhone, `Welcome to EduSkill, ${studentData.name}! You're registered. Reference No: ${referenceNo}.`);

    res.status(201).json({
      success: true,
      referenceNo, enrollmentId, studentId,
      name: studentData.name,
      // The confirmation step (Step 4) renders its template client-side using
      // this response plus the campaign object it already fetched in Step 1
      // (course/batch/start_date names), so nothing further is needed here.
      feedback_enabled: !!campaign.feedback_enabled,
      counselor_toggle_enabled: !!campaign.counselor_toggle_enabled,
    });
  } catch (error) {
    console.error('Campaign registration error:', error);
    logRegistrationFailure(`campaign:${req.params.slug}`, studentData, error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Step 3 -- feedback / interests / counselor opt-in. studentId comes back
// from the register response above.
router.post('/:slug/feedback', async (req, res) => {
  const { studentId, rating, interests, counselor_opt_in } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query('SELECT id FROM campaigns WHERE slug = ?', [req.params.slug]);
    if (!campaign) return res.status(404).json({ error: 'This link does not exist.' });
    await connection.query(
      `UPDATE campaign_registrations SET feedback_rating = ?, selected_interests = ?, counselor_opt_in = ?, feedback_submitted_at = NOW()
       WHERE campaign_id = ? AND student_id = ?`,
      [rating || null, JSON.stringify(Array.isArray(interests) ? interests : []), !!counselor_opt_in, campaign.id, studentId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Short-link resolver: /s/[code] (Next.js page) calls this to find which
// campaign slug to redirect to.
router.get('/short/:code', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[row]] = await connection.query(
      `SELECT c.slug FROM campaign_short_links l JOIN campaigns c ON c.id = l.campaign_id WHERE l.code = ?`,
      [req.params.code]
    );
    if (!row) return res.status(404).json({ error: 'Short link not found.' });
    res.json({ success: true, slug: row.slug });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
