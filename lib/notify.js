const pool = require('../config/db');

// SMS/WhatsApp notifications (dev-prompt Priority 0 item #9). No provider is
// hard-coded — the admin pastes a ready-to-call URL template for whichever
// gateway they have an account with (Settings -> Notifications), the same
// way SMTP is configured in email.js. Until a template is set, every call
// here is a safe no-op: it logs and returns, with zero effect on the caller
// (registration/payment/etc. all fire these without awaiting them anyway).
//
// Template format: any URL, with the literal placeholders {phone} and
// {message} substituted (URL-encoded) at send time. Fits the common
// "GET request with your API key baked into the URL" style used by most
// Indian SMS/WhatsApp gateways (MSG91, Fast2SMS, Gupshup, etc.) — e.g.
//   https://api.example.com/send?authkey=XXXX&mobile={phone}&message={message}
// If a specific provider needs a POST body instead, extend `callTemplate`
// below once we know which one — deliberately not guessing that shape now.

let cache = { at: 0, cfg: null };
const CACHE_MS = 60 * 1000;

async function loadConfig() {
  if (cache.cfg && Date.now() - cache.at < CACHE_MS) return cache.cfg;
  let rows = [];
  try {
    const connection = await pool.getConnection();
    try {
      [rows] = await connection.query(
        "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('sms_url_template', 'whatsapp_url_template')"
      );
    } finally {
      connection.release();
    }
  } catch (e) {
    console.warn('Could not read SMS/WhatsApp settings from DB:', e.message);
  }
  const cfg = rows.reduce((acc, r) => { acc[r.setting_key] = r.setting_value; return acc; }, {});
  cache = { at: Date.now(), cfg };
  return cfg;
}

async function callTemplate(template, label, phone, message) {
  if (!template) {
    console.log(`${label} not configured — skipping (would have sent to ${phone}).`);
    return;
  }
  const url = template
    .replace('{phone}', encodeURIComponent(phone))
    .replace('{message}', encodeURIComponent(message));
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.error(`${label} send failed (HTTP ${res.status}) for ${phone}`);
    }
  } catch (e) {
    console.error(`${label} send error for ${phone}:`, e.message);
  }
}

async function sendSms(phone, message) {
  if (!phone) return;
  const cfg = await loadConfig();
  await callTemplate(cfg.sms_url_template, 'SMS', phone, message);
}

async function sendWhatsApp(phone, message) {
  if (!phone) return;
  const cfg = await loadConfig();
  await callTemplate(cfg.whatsapp_url_template, 'WhatsApp', phone, message);
}

// Convenience: fire both, fire-and-forget, never throws to the caller.
function notifyStudent(phone, message) {
  if (!phone) return;
  sendSms(phone, message).catch((e) => console.error('sendSms failed:', e.message));
  sendWhatsApp(phone, message).catch((e) => console.error('sendWhatsApp failed:', e.message));
}

module.exports = { sendSms, sendWhatsApp, notifyStudent };
