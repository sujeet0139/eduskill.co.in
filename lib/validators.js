// Shared field validators (server-side). Kept framework-agnostic so both the
// Express routes and any scripts can reuse them. Frontend mirrors these rules
// in frontend/lib/validators.js — keep the two in sync.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Indian mobile: 10 digits starting 6-9. Accepts optional +91/0 prefix which we strip.
const MOBILE_RE = /^[6-9]\d{9}$/;
const AADHAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function normalizeMobile(v) {
  if (v == null) return '';
  return String(v).replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
}

function isValidEmail(v) {
  return EMAIL_RE.test(String(v || '').trim());
}
function isValidMobile(v) {
  return MOBILE_RE.test(normalizeMobile(v));
}
function isValidAadhar(v) {
  return AADHAR_RE.test(String(v || '').replace(/\s/g, ''));
}
function isValidPan(v) {
  return PAN_RE.test(String(v || '').trim().toUpperCase());
}

// Validate a set of student fields. Only checks fields that are present
// (unless required flags force presence upstream). Returns an error string or null.
function validateStudentFields(data, { requireMobile = false } = {}) {
  if (data.email != null && data.email !== '' && !isValidEmail(data.email)) {
    return 'Please enter a valid email address.';
  }
  const phone = data.phone ?? data.mobile;
  if (requireMobile && (phone == null || phone === '')) {
    return 'Mobile number is required.';
  }
  if (phone != null && phone !== '' && !isValidMobile(phone)) {
    return 'Mobile number must be a valid 10-digit Indian number (starting 6-9).';
  }
  if (data.aadhar != null && data.aadhar !== '' && !isValidAadhar(data.aadhar)) {
    return 'Aadhaar number must be exactly 12 digits.';
  }
  if (data.pan != null && data.pan !== '' && !isValidPan(data.pan)) {
    return 'PAN must be in the format ABCDE1234F.';
  }
  return null;
}

module.exports = {
  EMAIL_RE, MOBILE_RE, AADHAR_RE, PAN_RE,
  normalizeMobile, isValidEmail, isValidMobile, isValidAadhar, isValidPan,
  validateStudentFields,
};
