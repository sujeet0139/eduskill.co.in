const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/authMiddleware');

// Gated with the same requireAdmin check every other admin feature in this
// app uses today. The dev-prompt's own item #22 (Super Admin/Admin/Faculty
// RBAC) isn't built yet -- revisit this once it lands, per the campaign
// spec's section 6 ("likely Admin and Super Admin only, not Faculty").

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHORT_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomShortCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  return out;
}

function publicUrl(slug) {
  const base = (process.env.FRONTEND_URL || 'https://eduskill.co.in').split(',')[0];
  return `${base}/c/${slug}`;
}

// ---- LIST / DETAIL ----
router.get('/', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [campaigns] = await connection.query(`
      SELECT c.*, co.name AS college_name, p.title AS program_title, cs.title AS course_title, b.name AS batch_name,
             (SELECT COUNT(*) FROM campaign_registrations WHERE campaign_id = c.id) AS registration_count
      FROM campaigns c
      LEFT JOIN colleges co ON c.college_id = co.id
      LEFT JOIN programs p ON c.program_id = p.id
      LEFT JOIN courses cs ON c.course_id = cs.id
      LEFT JOIN batches b ON c.batch_id = b.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Compare 2+ campaigns side by side: GET /api/campaigns/compare?ids=1,2,3
// Registered BEFORE GET /:id -- Express matches routes in registration
// order, and "/compare" would otherwise be swallowed by "/:id" (id="compare").
router.get('/compare', requireAdmin, async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length < 2) return res.status(400).json({ error: 'Provide 2 or more campaign ids to compare, e.g. ?ids=1,2' });
  let connection;
  try {
    connection = await pool.getConnection();
    const funnels = [];
    for (const id of ids) {
      const f = await funnelFor(connection, id);
      if (f) funnels.push(f);
    }
    res.json({ success: true, funnels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    const [benefits] = await connection.query('SELECT * FROM campaign_benefits WHERE campaign_id = ? ORDER BY order_no', [req.params.id]);
    const [interests] = await connection.query('SELECT * FROM campaign_interests WHERE campaign_id = ? ORDER BY order_no', [req.params.id]);
    const [[shortLink]] = await connection.query('SELECT code FROM campaign_short_links WHERE campaign_id = ? ORDER BY id DESC LIMIT 1', [req.params.id]);
    res.json({
      success: true,
      campaign: {
        ...campaign,
        benefits,
        interests,
        url: publicUrl(campaign.slug),
        shortUrl: shortLink ? `${(process.env.FRONTEND_URL || 'https://eduskill.co.in').split(',')[0]}/s/${shortLink.code}` : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- CREATE / UPDATE (slug is set once at creation and never changed --
// section 2's "editing content later must NOT change the URL") ----
router.post('/', requireAdmin, async (req, res) => {
  const {
    slug, name, college_id, program_id, course_id, batch_id,
    hero_tag, headline, subheading, feedback_enabled, counselor_toggle_enabled,
    confirmation_template, starts_at, ends_at, status,
    benefits, interests,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required.' });
  if (!slug || !SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'slug must be lowercase letters, numbers, and hyphens only (e.g. noida-college-session).' });
  }
  if (!college_id && !program_id && !course_id && !batch_id) {
    return res.status(400).json({ error: 'At least one link target (College/Program/Course/Batch) is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [[existing]] = await connection.query('SELECT id FROM campaigns WHERE slug = ?', [slug]);
    if (existing) return res.status(400).json({ error: 'That slug is already in use by another campaign.' });

    const [result] = await connection.query(
      `INSERT INTO campaigns (slug, name, college_id, program_id, course_id, batch_id, hero_tag, headline, subheading,
        feedback_enabled, counselor_toggle_enabled, confirmation_template, starts_at, ends_at, status, created_by_admin_id, created_by_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name, college_id || null, program_id || null, course_id || null, batch_id || null,
       hero_tag || null, headline || null, subheading || null,
       feedback_enabled !== false, counselor_toggle_enabled !== false,
       confirmation_template || DEFAULT_CONFIRMATION_TEMPLATE,
       starts_at || null, ends_at || null, status || 'active',
       req.admin && req.admin.id, req.admin && req.admin.email]
    );
    const campaignId = result.insertId;

    if (Array.isArray(benefits)) await replaceBenefits(connection, campaignId, benefits);
    if (Array.isArray(interests)) await replaceInterests(connection, campaignId, interests);

    res.status(201).json({ success: true, message: 'Campaign created.', id: campaignId, url: publicUrl(slug) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

const DEFAULT_CONFIRMATION_TEMPLATE =
  "Thanks, {name}! You're registered for {course} ({batch}), starting {start_date}. " +
  "Join the group here: {group_link}";

async function replaceBenefits(connection, campaignId, benefits) {
  await connection.query('DELETE FROM campaign_benefits WHERE campaign_id = ?', [campaignId]);
  for (let i = 0; i < benefits.length; i++) {
    const b = benefits[i];
    if (!b.title) continue;
    await connection.query(
      'INSERT INTO campaign_benefits (campaign_id, icon, title, description, order_no) VALUES (?, ?, ?, ?, ?)',
      [campaignId, b.icon || null, b.title, b.description || null, i]
    );
  }
}
async function replaceInterests(connection, campaignId, interests) {
  await connection.query('DELETE FROM campaign_interests WHERE campaign_id = ?', [campaignId]);
  for (let i = 0; i < interests.length; i++) {
    const label = typeof interests[i] === 'string' ? interests[i] : interests[i].label;
    if (!label) continue;
    await connection.query(
      'INSERT INTO campaign_interests (campaign_id, label, order_no) VALUES (?, ?, ?)',
      [campaignId, label, i]
    );
  }
}

router.put('/:id', requireAdmin, async (req, res) => {
  const {
    name, college_id, program_id, course_id, batch_id,
    hero_tag, headline, subheading, feedback_enabled, counselor_toggle_enabled,
    confirmation_template, starts_at, ends_at, status,
    benefits, interests,
  } = req.body;
  // slug is intentionally never accepted here -- see the comment above POST /.
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `UPDATE campaigns SET name=?, college_id=?, program_id=?, course_id=?, batch_id=?, hero_tag=?, headline=?, subheading=?,
        feedback_enabled=?, counselor_toggle_enabled=?, confirmation_template=?, starts_at=?, ends_at=?, status=? WHERE id=?`,
      [name, college_id || null, program_id || null, course_id || null, batch_id || null,
       hero_tag || null, headline || null, subheading || null,
       feedback_enabled !== false, counselor_toggle_enabled !== false,
       confirmation_template || DEFAULT_CONFIRMATION_TEMPLATE,
       starts_at || null, ends_at || null, status || 'active', req.params.id]
    );
    if (Array.isArray(benefits)) await replaceBenefits(connection, req.params.id, benefits);
    if (Array.isArray(interests)) await replaceInterests(connection, req.params.id, interests);
    res.json({ success: true, message: 'Campaign updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('DELETE FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Campaign deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- CLONE (section 7) -- copies everything, including the target, so
// admin only has to swap what changed for the new visit. ----
router.post('/:id/clone', requireAdmin, async (req, res) => {
  const { slug, name } = req.body;
  if (!slug || !SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'slug must be lowercase letters, numbers, and hyphens only.' });
  }
  if (!name) return res.status(400).json({ error: 'name is required.' });

  let connection;
  try {
    connection = await pool.getConnection();
    const [[source]] = await connection.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!source) return res.status(404).json({ error: 'Campaign not found.' });
    const [[existingSlug]] = await connection.query('SELECT id FROM campaigns WHERE slug = ?', [slug]);
    if (existingSlug) return res.status(400).json({ error: 'That slug is already in use by another campaign.' });

    const [result] = await connection.query(
      `INSERT INTO campaigns (slug, name, college_id, program_id, course_id, batch_id, hero_tag, headline, subheading,
        feedback_enabled, counselor_toggle_enabled, confirmation_template, status, created_by_admin_id, created_by_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [slug, name, source.college_id, source.program_id, source.course_id, source.batch_id,
       source.hero_tag, source.headline, source.subheading,
       source.feedback_enabled, source.counselor_toggle_enabled, source.confirmation_template,
       req.admin && req.admin.id, req.admin && req.admin.email]
    );
    const newId = result.insertId;

    const [benefits] = await connection.query('SELECT icon, title, description, order_no FROM campaign_benefits WHERE campaign_id = ? ORDER BY order_no', [req.params.id]);
    for (const b of benefits) {
      await connection.query('INSERT INTO campaign_benefits (campaign_id, icon, title, description, order_no) VALUES (?, ?, ?, ?, ?)', [newId, b.icon, b.title, b.description, b.order_no]);
    }
    const [interests] = await connection.query('SELECT label, order_no FROM campaign_interests WHERE campaign_id = ? ORDER BY order_no', [req.params.id]);
    for (const i of interests) {
      await connection.query('INSERT INTO campaign_interests (campaign_id, label, order_no) VALUES (?, ?, ?)', [newId, i.label, i.order_no]);
    }

    res.status(201).json({ success: true, message: 'Campaign cloned.', id: newId, url: publicUrl(slug) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- SHORT LINK (section 2) ----
router.post('/:id/short-link', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query('SELECT slug FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

    let code, attempts = 0;
    do {
      code = randomShortCode();
      const [[clash]] = await connection.query('SELECT id FROM campaign_short_links WHERE code = ?', [code]);
      if (!clash) break;
    } while (++attempts < 5);

    await connection.query('INSERT INTO campaign_short_links (code, campaign_id) VALUES (?, ?)', [code, req.params.id]);
    res.json({ success: true, code, shortUrl: `${(process.env.FRONTEND_URL || 'https://eduskill.co.in').split(',')[0]}/s/${code}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- QR CODE (section 2) -- generated server-side, no external service,
// so it works even if this box has no outbound internet. ----
router.get('/:id/qr', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query('SELECT slug FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    const png = await QRCode.toBuffer(publicUrl(campaign.slug), { type: 'png', width: 512, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign.slug}-qr.png"`);
    res.send(png);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- REGISTRATIONS (section 4) ----
router.get('/:id/registrations', requireAdmin, async (req, res) => {
  const { q } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let query = `
      SELECT cr.*, s.name, s.phone, s.email, s.created_at AS registered_at
      FROM campaign_registrations cr JOIN students s ON s.id = cr.student_id
      WHERE cr.campaign_id = ?
    `;
    const params = [req.params.id];
    if (q) {
      query += ' AND (s.name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    query += ' ORDER BY s.created_at DESC';
    const [registrations] = await connection.query(query, params);
    res.json({ success: true, registrations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/:id/registrations/export', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [[campaign]] = await connection.query('SELECT slug FROM campaigns WHERE id = ?', [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    const [rows] = await connection.query(`
      SELECT s.name, s.phone, s.email, s.created_at, cr.feedback_rating, cr.selected_interests, cr.counselor_opt_in, cr.contacted
      FROM campaign_registrations cr JOIN students s ON s.id = cr.student_id
      WHERE cr.campaign_id = ? ORDER BY s.created_at DESC
    `, [req.params.id]);

    const csvRows = [['Name', 'Phone', 'Email', 'Registered At', 'Feedback Rating', 'Interests', 'Counselor Opt-in', 'Contacted'].join(',')];
    rows.forEach((r) => {
      csvRows.push([
        `"${(r.name || '').replace(/"/g, '""')}"`, r.phone || '', r.email || '',
        r.created_at ? r.created_at.toISOString() : '',
        r.feedback_rating ?? '', `"${(r.selected_interests ? JSON.parse(r.selected_interests).join('; ') : '')}"`,
        r.counselor_opt_in ? 'Yes' : 'No', r.contacted ? 'Yes' : 'No',
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign.slug}-registrations.csv"`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/:id/registrations/bulk-contacted', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids (non-empty array) is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('UPDATE campaign_registrations SET contacted = TRUE WHERE id IN (?) AND campaign_id = ?', [ids, req.params.id]);
    res.json({ success: true, message: `Marked ${ids.length} registration(s) as contacted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ---- FUNNEL (section 5) ----
async function funnelFor(connection, campaignId) {
  const [[campaign]] = await connection.query('SELECT id, name, slug, view_count, registration_starts_count FROM campaigns WHERE id = ?', [campaignId]);
  if (!campaign) return null;
  const [[stats]] = await connection.query(
    `SELECT COUNT(*) AS completed,
            SUM(feedback_submitted_at IS NOT NULL) AS feedback_submitted,
            SUM(counselor_opt_in = TRUE) AS counselor_optins
     FROM campaign_registrations WHERE campaign_id = ?`,
    [campaignId]
  );
  return {
    campaign_id: campaign.id, name: campaign.name, slug: campaign.slug,
    link_opens: campaign.view_count,
    registrations_started: campaign.registration_starts_count,
    registrations_completed: Number(stats.completed || 0),
    feedback_submitted: Number(stats.feedback_submitted || 0),
    counselor_optins: Number(stats.counselor_optins || 0),
  };
}

router.get('/:id/funnel', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const funnel = await funnelFor(connection, req.params.id);
    if (!funnel) return res.status(404).json({ error: 'Campaign not found.' });
    res.json({ success: true, funnel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
