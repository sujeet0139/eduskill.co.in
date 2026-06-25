// Central API client. Base URL comes from NEXT_PUBLIC_API_URL at build time;
// falls back to the local backend for development.
const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003").replace(/\/$/, "");

async function request(path, { method = "GET", body, token, isForm } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData — let the browser set the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    // credentials: "include" sends/receives the httpOnly session cookie across
    // the eduskill.co.in <-> api.eduskill.co.in boundary.
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: "include" });
  } catch (e) {
    throw new Error("Cannot reach the server. Please try again later.");
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

export const api = {
  base: BASE,
  get: (p, token) => request(p, { token }),
  post: (p, body, token) => request(p, { method: "POST", body, token }),
  put: (p, body, token) => request(p, { method: "PUT", body, token }),
  del: (p, token) => request(p, { method: "DELETE", token }),
  postForm: (p, formData, token) => request(p, { method: "POST", body: formData, token, isForm: true }),
  putForm: (p, formData, token) => request(p, { method: "PUT", body: formData, token, isForm: true }),
};
