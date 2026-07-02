// Lightweight client-side auth storage (JWT in localStorage).
// Only call these from client components / event handlers.

const ADMIN_KEY = "adminToken";
const ADMIN_INFO = "adminInfo";
const STUDENT_TOKEN = "studentToken";
const STUDENT_INFO = "studentInfo";
const TEACHER_TOKEN = "teacherToken";
const TEACHER_INFO = "teacherInfo";

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

export const teacherAuth = {
  token: () => safeGet(TEACHER_TOKEN),
  teacher: () => {
    try { return JSON.parse(safeGet(TEACHER_INFO) || "null"); } catch { return null; }
  },
  login: (token, teacher) => {
    safeSet(TEACHER_TOKEN, token);
    safeSet(TEACHER_INFO, JSON.stringify(teacher || {}));
  },
  logout: () => {
    safeDel(TEACHER_TOKEN);
    safeDel(TEACHER_INFO);
  },
};
