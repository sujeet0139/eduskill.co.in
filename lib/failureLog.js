const pool = require('../config/db');

// Fields that should never land in a diagnostic log even redacted-in-place.
const SENSITIVE_KEYS = ['password', 'password_hash', 'passwordHash', 'confirmPassword'];

function redact(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = { ...payload };
  for (const key of SENSITIVE_KEYS) {
    if (key in clone) clone[key] = '[redacted]';
  }
  return clone;
}

// Best-effort diagnostic log for failed student registration / add-student
// submissions (Priority 0 item #1 — "log failed submissions server-side with
// enough detail to diagnose"). Never throws — logging must not become a new
// way for the request to fail.
async function logRegistrationFailure(source, payload, error) {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO registration_failures (source, payload_json, error_message, created_at) VALUES (?, ?, ?, NOW())`,
        [source, JSON.stringify(redact(payload)), String(error && error.message || error).slice(0, 1000)]
      );
    } finally {
      connection.release();
    }
  } catch (logErr) {
    // DB itself may be the thing that's down — fall back to console so the
    // failure is still visible somewhere.
    console.error('Failed to write registration_failures row:', logErr.message);
  }
}

module.exports = { logRegistrationFailure };
