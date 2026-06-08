// Mirrors the colleges seeded in the backend (check-db.js). Used by the public
// registration form because GET /api/colleges is admin-protected.
export const COLLEGES = [
  { id: 1, name: "JANKIDEVI GAURI SHANKAR SARAF DEGREE COLLEGE", district: "Darbhanga" },
  { id: 2, name: "MARWARI COLLEGE", district: "Darbhanga" },
  { id: 3, name: "SATYA NARAYAN MEHARALI RAMANAND CHARAN KARPURI COLLEGE", district: "Samastipur" },
  { id: 4, name: "JHUMAK MAHASETH DHARMAPRIYA LAL MAHILA COLLEGE", district: "Madhubani" },
  { id: 5, name: "VISHWESHWAR SINGH JANTA COLLEGE", district: "Darbhanga" },
  { id: 6, name: "KALIDAS VIDYAPATI SCIENCE COLLEGE", district: "Darbhanga" },
  { id: 7, name: "CHETHRU MAHTO JANTA COLLEGE", district: "Darbhanga" },
  { id: 8, name: "JANTA KOSHI MAHAVIDYALAYA", district: "Madhubani" },
];

export const DEPARTMENTS = ["CSE", "Commerce", "Science", "Arts", "Management", "Other"];
