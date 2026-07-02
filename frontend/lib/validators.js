// Client-side field validators. Mirrors the server-side rules in
// lib/validators.js (repo root) — keep the two in sync.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const AADHAR_RE = /^\d{12}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizeMobile(v) {
  if (v == null) return "";
  return String(v).replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
}

export function isValidEmail(v) {
  return EMAIL_RE.test(String(v || "").trim());
}
export function isValidMobile(v) {
  return MOBILE_RE.test(normalizeMobile(v));
}
export function isValidAadhar(v) {
  return AADHAR_RE.test(String(v || "").replace(/\s/g, ""));
}
export function isValidPan(v) {
  return PAN_RE.test(String(v || "").trim().toUpperCase());
}

// Returns an error string for the first invalid field, or "" if all valid.
// `data` is the form values keyed by field_name.
export function validateStudentForm(data) {
  if (data.email && !isValidEmail(data.email)) return "Please enter a valid email address.";
  const phone = data.phone ?? data.mobile;
  if (phone && !isValidMobile(phone))
    return "Mobile number must be a valid 10-digit Indian number (starting 6-9).";
  if (data.aadhar && !isValidAadhar(data.aadhar)) return "Aadhaar number must be exactly 12 digits.";
  if (data.pan && !isValidPan(data.pan)) return "PAN must be in the format ABCDE1234F.";
  return "";
}
