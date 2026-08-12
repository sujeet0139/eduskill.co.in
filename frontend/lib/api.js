// Central API client. Base URL comes from NEXT_PUBLIC_API_URL at build time;
// falls back to the local backend for development.
const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

// Default request timeout. Without this, a hung backend (e.g. a slow SMTP
// call it's waiting on, or a dropped connection) left the UI spinning on
// "please wait" forever with no way out — see dev-prompt Priority 0 item #1.
const DEFAULT_TIMEOUT_MS = 15000;

async function request(path, { method = "GET", body, token, isForm, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData — let the browser set the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    // credentials: "include" sends/receives the httpOnly session cookie across
    // the eduskill.co.in <-> api.eduskill.co.in boundary.
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: "include", signal: controller.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("The server took too long to respond. Please check your connection and try again.");
    }
    throw new Error("Cannot reach the server. Please try again later.");
  } finally {
    if (timer) clearTimeout(timer);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

// Resolve an uploaded file path to an absolute URL. Uploads are stored on the
// API server as "/uploads/..."; served from the frontend origin they 404, so
// prefix the API base. Full http(s) URLs (e.g. Cloudinary) are returned as-is.
function mediaUrl(p) {
  if (!p) return "";
  if (/^https?:\/\//.test(p)) return p;
  return `${BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}

export const api = {
  base: BASE,
  mediaUrl,
  // Every method takes an optional trailing `opts` ({ timeoutMs }) so slow-by
  // -nature calls (bulk import, file uploads) can opt into a longer timeout
  // instead of the 15s default.
  get: (p, token, opts) => request(p, { token, ...opts }),
  post: (p, body, token, opts) => request(p, { method: "POST", body, token, ...opts }),
  put: (p, body, token, opts) => request(p, { method: "PUT", body, token, ...opts }),
  del: (p, token, opts) => request(p, { method: "DELETE", token, ...opts }),
  postForm: (p, formData, token, opts) => request(p, { method: "POST", body: formData, token, isForm: true, ...opts }),
  putForm: (p, formData, token, opts) => request(p, { method: "PUT", body: formData, token, isForm: true, ...opts }),
};
