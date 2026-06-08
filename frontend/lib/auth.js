// Lightweight client-side auth storage (JWT in localStorage).
// Only call these from client components / event handlers.

const ADMIN_KEY = "adminToken";
const ADMIN_INFO = "adminInfo";
const STUDENT_TOKEN = "studentToken";
const STUDENT_INFO = "studentInfo";

const safeGet = (k) => (typeof window !== "undefined" ? window.localStorage.getItem(k) : null);
const safeSet = (k, v) => typeof window !== "undefined" && window.localStorage.setItem(k, v);
const safeDel = (k) => typeof window !== "undefined" && window.localStorage.removeItem(k);

export const adminAuth = {
  token: () => safeGet(ADMIN_KEY),
  info: () => {
    try { return JSON.parse(safeGet(ADMIN_INFO) || "null"); } catch { return null; }
  },
  login: (token, admin) => {
    safeSet(ADMIN_KEY, token);
    safeSet(ADMIN_INFO, JSON.stringify(admin || {}));
  },
  logout: () => {
    safeDel(ADMIN_KEY);
    safeDel(ADMIN_INFO);
  },
};

export const studentAuth = {
  token: () => safeGet(STUDENT_TOKEN),
  student: () => {
    try { return JSON.parse(safeGet(STUDENT_INFO) || "null"); } catch { return null; }
  },
  login: (token, student) => {
    safeSet(STUDENT_TOKEN, token);
    safeSet(STUDENT_INFO, JSON.stringify(student || {}));
  },
  logout: () => {
    safeDel(STUDENT_TOKEN);
    safeDel(STUDENT_INFO);
  },
};
