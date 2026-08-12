const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { send } = require('../email');
const { requireAdmin } = require('../middleware/authMiddleware');

// Resolve the recipient set from audience filters. All filters are optional and
// combine with AND. Returns [{ id, name, email, phone }].
async function resolveRecipients(connection, { college_id, status, course_id, program_id, student_ids }) {
  let query = `SELECT DISTINCT s.id, s.name, s.email, s.phone, s.reference_no
               FROM students s`;
  const joins = [];
  const where = ['1=1'];
  const params = [];

  if (course_id) {
    joins.push('JOIN student_courses sc ON sc.student_id = s.id AND sc.course_id = ?');
    params.push(course_id);
  }
  if (program_id) {
    joins.push('JOIN student_programs sp ON sp.student_id = s.id AND sp.program_id = ?');
    params.push(program_id);
  }
  if (college_id) { where.push('s.college_id = ?'); params.push(college_id); }
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (Array.isArray(student_ids) && student_ids.length) {
    where.push(`s.id IN (${student_ids.map(() => '?').join(',')})`);
    params.push(...student_ids);
  }

  query += ' ' + joins.join(' ') + ' WHERE ' + where.join(' AND ') + ' ORDER BY s.name ASC';
  const [rows] = await connection.query(query, params);
  return rows;
}

// Replace {{name}}, {{email}}, {{ref}} placeholders in a template.
function personalize(text, student) {
  return String(text || '')
    .replace(/\{\{\s*name\s*\}\}/gi, student.name || '')
    .replace(/\{\{\s*email\s*\}\}/gi, student.email || '')
    .replace(/\{\{\s*ref\s*\}\}/gi, student.reference_no || '');
}

// Wrap a plain-text message in a simple branded HTML shell.
function htmlShell(bodyText) {
  const safe = String(bodyText || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111">
    <div style="background:#1e3a8a;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">EduSkill</div>
    <div style="padding:20px;font-size:14px;line-height:1.6">${safe}</div>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee">EduSkill • eduskill.co.in</div>
  </div>`;
}

// PREVIEW the recipient list for a set of filters (admin picks audience).
router.get('/recipients', requireAdmin, async (req, res) => {
  const { college_id, status, course_id, program_id } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    const recipients = await resolveRecipients(connection, { college_id, status, course_id, program_id });
    connection.release();
    res.json({ success: true, count: recipients.length, recipients });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: error.message });
  }
});

// SEND an email broadcast to the resolved audience.
router.post('/email', requireAdmin, async (req, res) => {
  const { subject, message, college_id, status, course_id, program_id, student_ids } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });

  let connection;
  try {
    connection = await pool.getConnection();
    const recipients = await resolveRecipients(connection, { college_id, status, course_id, program_id, student_ids });

    let sent = 0;
    const errors = [];
    for (const r of recipients) {
      if (!r.email) continue;
      try {
        await send(r.email, personalize(subject, r), htmlShell(personalize(message, r)));
        sent++;
      } catch (e) {
        errors.push({ email: r.email, error: e.message });
      }
    }

    // Log the broadcast (best-effort; table created by check-db).
    try {
      await connection.query(
        `INSERT INTO communication_logs (channel, subject, audience, recipient_count, sent_count, sent_by)
         VALUES ('email', ?, ?, ?, ?, ?)`,
        [subject, JSON.stringify({ college_id, status, course_id, program_id }), recipients.length, sent, req.admin?.email || null]
      );
    } catch (e) { /* logging is non-fatal */ }

    connection.release();
    res.json({ success: true, message: `Email sent to ${sent} of ${recipients.length} recipients.`, sent, total: recipients.length, errors: errors.length ? errors : undefined });
  } catch (error) {
    if (connection) connection.release();
    res.status(500).json({ error: error.message });
  }
});

// LOG a WhatsApp broadcast (the actual sending is click-to-chat on the client).
router.post('/log-whatsapp', requireAdmin, async (req, res) => {
  const { subject, recipient_count } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO communication_logs (channel, subject, audience, recipient_count, sent_count, sent_by)
       VALUES ('whatsapp', ?, ?, ?, ?, ?)`,
      [subject || 'WhatsApp broadcast', '{}', recipient_count || 0, recipient_count || 0, req.admin?.email || null]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Recent broadcast history.
router.get('/history', requireAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [logs] = await connection.query('SELECT * FROM communication_logs ORDER BY created_at DESC LIMIT 30');
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
