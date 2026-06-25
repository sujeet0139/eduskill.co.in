const jwt = require('jsonwebtoken');

// Single source of truth for the JWT secret. Signing (routes/auth.js) and
// verifying (the auth middlewares) both import this, so they can never drift
// apart — which was the previous bug: routes signed with process.env.JWT_SECRET
// while the middleware verified against a hard-coded fallback.
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set — using an insecure development fallback. Set JWT_SECRET in your .env for production.');
}

const COOKIE_NAME = 'token';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h, matches the JWT expiry

// Pull the JWT from the Authorization: Bearer header first (API tools / older
// clients), then fall back to the httpOnly session cookie. Cookie parsing is
// done by hand to avoid adding a cookie-parser dependency (keeps the VPS
// "git pull + pm2 restart" deploy from breaking on a missing module).
function getTokenFromReq(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(COOKIE_NAME + '='));
    if (match) return decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  }
  return null;
}

// Options for res.cookie()/res.clearCookie(). `secure` follows NODE_ENV so the
// same code works on http://localhost and over HTTPS in production. `domain` is
// optional: with a single backend host (api.eduskill.co.in) a host-only cookie
// is enough; only set COOKIE_DOMAIN (e.g. ".eduskill.co.in") if you need the
// cookie shared across multiple subdomains. SameSite=Lax is safe here because
// eduskill.co.in and api.eduskill.co.in are the same site.
function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

module.exports = { jwt, JWT_SECRET, COOKIE_NAME, MAX_AGE_MS, getTokenFromReq, authCookieOptions };
