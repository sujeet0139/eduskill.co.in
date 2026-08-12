"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { StatusBadge, Input, Select, Button, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { validateStudentForm, normalizeMobile } from "@/lib/validators";
import { useToast } from "@/components/Toast";

// Fields the PUT /api/students/:id endpoint accepts.
const blankEdit = {
  name: "", email: "", phone: "", collegeId: "", department: "",
  status: "registered", roll_number: "", current_year: 1, wallet_balance: 0,
};

const blankAdd = {
  name: "", email: "", phone: "", collegeId: "", department: "",
  roll_number: "", current_year: 1, aadhar: "", pan: "", password: "",
};

// Build a wa.me click-to-chat link with a pre-filled (still editable) message.
function waLink(phone, message) {
  const num = normalizeMobile(phone);
  if (!num) return null;
  return `https://wa.me/91${num}?text=${encodeURIComponent(message)}`;
}
function mailLink(email, subject, body) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Minimal CSV parser: first row is the header, commas separate columns.
// Handles simple quoted values. Good enough for admin bulk imports.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line) => {
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  // Edit modal state
  const [editing, setEditing] = useState(null); // student being edited (or null)
  const [form, setForm] = useState(blankEdit);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  // Add modal state
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState(blankAdd);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addResult, setAddResult] = useState(null);

  // Import modal state
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Password modal state
  const [pwStudent, setPwStudent] = useState(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwResult, setPwResult] = useState(null);

  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    setLoading(true);
    api.get("/api/students", token())
      .then((d) => setStudents(d.students || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/api/colleges", token())
      .then((d) => setColleges(d.colleges || []))
      .catch(() => {});
  }, []);

  const verify = async (id) => {
    try { await api.put(`/api/students/${id}/verify`, {}, token()); load(); }
    catch (e) { notify.error(e.message); }
  };

  const remove = async (id) => {
    if (!(await notify.confirm("Delete this student? This cannot be undone."))) return;
    try { await api.del(`/api/students/${id}`, token()); load(); }
    catch (e) { notify.error(e.message); }
  };

  const exportStudents = async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`${api.base}/api/students/export?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token()}` },
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eduskill-students-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- Edit ----
  const openEdit = (s) => {
    setEditError("");
    setEditing(s);
    setForm({
      name: s.name || "", email: s.email || "", phone: s.phone || "",
      collegeId: s.college_id || "", department: s.department || "",
      status: s.status || "registered", roll_number: s.roll_number || "",
      current_year: s.current_year || 1, wallet_balance: s.wallet_balance || 0,
    });
  };
  const closeEdit = () => { setEditing(null); setForm(blankEdit); setEditError(""); };
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setEditError("");
    const v = validateStudentForm(form);
    if (v) { setEditError(v); return; }
    setSaving(true);
    try {
      await api.put(`/api/students/${editing.id}`, form, token());
      closeEdit();
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file) => {
    if (!file || !editing) return;
    setPhotoBusy(true);
    setEditError("");
    try {
      const fd = new FormData();
      fd.append("document", file);
      fd.append("document_type", "photo");
      await api.postForm(`/api/students/${editing.id}/photo`, fd, token());
      notify.success("Photo uploaded.");
    } catch (err) {
      setEditError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  // ---- Add ----
  const openAdd = () => { setAddForm(blankAdd); setAddError(""); setAddResult(null); setAdding(true); };
  const changeAdd = (e) => setAddForm({ ...addForm, [e.target.name]: e.target.value });
  const submitAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    const v = validateStudentForm(addForm);
    if (v) { setAddError(v); return; }
    setAddSaving(true);
    try {
      const res = await api.post("/api/students", addForm, token());
      setAddResult(res);
      load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  };

  // ---- Import ----
  const onCsvFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(String(ev.target.result || ""));
      // Map common column aliases to the API's expected keys.
      const mapped = rows.map((r) => ({
        name: r.name || r.full_name || "",
        email: r.email || "",
        phone: r.phone || r.mobile || "",
        roll_number: r.roll_number || r.roll || "",
        current_year: r.current_year || r.year || 1,
        college_id: r.college_id || r.collegeid || "",
        department: r.department || "",
      }));
      setImportRows(mapped);
      setImportResult(null);
    };
    reader.readAsText(file);
  };
  const submitImport = async () => {
    if (!importRows.length) return;
    setImportBusy(true);
    try {
      const res = await api.post("/api/students/bulk-import", { students: importRows }, token(), { timeoutMs: 60000 });
      setImportResult(res);
      load();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImportBusy(false);
    }
  };

  // ---- Password ----
  const openPw = (s) => { setPwStudent(s); setPwValue(""); setPwResult(null); setPwBusy(false); };
  const submitPw = async () => {
    setPwBusy(true);
    try {
      const res = await api.put(`/api/students/${pwStudent.id}/set-password`, pwValue ? { password: pwValue } : {}, token());
      // If admin typed a password, surface it so they can share it too.
      setPwResult({ ...res, password: res.password || pwValue });
    } catch (err) {
      setPwResult({ error: err.message });
    } finally {
      setPwBusy(false);
    }
  };

  const filtered = students.filter((s) =>
    [s.name, s.email, s.reference_no, s.phone].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  const loginUrl = (typeof window !== "undefined" ? window.location.origin : "https://eduskill.co.in") + "/login";

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${students.length} registered`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            />
            <Button onClick={openAdd} className="whitespace-nowrap">+ Add Student</Button>
            <Button onClick={() => { setImporting(true); setImportRows([]); setImportResult(null); }} className="whitespace-nowrap">Import CSV</Button>
            <Button onClick={exportStudents} loading={exporting} className="whitespace-nowrap">Export CSV</Button>
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Enroll ID</Th><Th>Ref</Th><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>College</Th><Th>Status</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><Td className="text-gray-500">Loading…</Td></tr>
          ) : filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No students found.</Td></tr>
          ) : filtered.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <Td className="font-mono text-xs">{s.enrollment_id || s.reference_no}</Td>
              <Td className="font-mono text-xs">{s.reference_no}</Td>
              <Td className="font-medium">
                <Link href={`/admin/students/${s.id}`} className="text-brand hover:underline">{s.name}</Link>
              </Td>
              <Td>{s.email}</Td>
              <Td>{s.phone}</Td>
              <Td className="max-w-[180px] truncate">{s.college_name}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => openEdit(s)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Edit</button>
                  <button onClick={() => openPw(s)} className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 hover:bg-purple-200">Password</button>
                  {s.phone && (
                    <a
                      href={waLink(s.phone, `Hi ${s.name}, this is a reminder from EduSkill regarding your pending course payment. Please complete it at your earliest. Ref: ${s.reference_no}`)}
                      target="_blank" rel="noreferrer"
                      className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200"
                    >WhatsApp</a>
                  )}
                  {s.email && (
                    <a
                      href={mailLink(s.email, "EduSkill — Payment Reminder", `Hi ${s.name},\n\nThis is a reminder regarding your pending course payment. Please complete it at your earliest.\n\nReference: ${s.reference_no}\n\nRegards,\nEduSkill Team`)}
                      className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 hover:bg-orange-200"
                    >Email</a>
                  )}
                  {s.status !== "verified" && (
                    <button onClick={() => verify(s.id)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Verify</button>
                  )}
                  <button onClick={() => remove(s.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {/* EDIT STUDENT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={closeEdit}>
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="mb-4 text-xs text-gray-500">Ref: <span className="font-mono">{editing.reference_no}</span></p>
            <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editError && <div className="sm:col-span-2"><Alert type="error">{editError}</Alert></div>}
              <Input label="Name" name="name" value={form.name} onChange={change} required />
              <Input label="Email" type="email" name="email" value={form.email} onChange={change} required />
              <Input label="Phone" name="phone" value={form.phone} onChange={change} required maxLength={10} />
              <Input label="Roll Number" name="roll_number" value={form.roll_number} onChange={change} />
              <Input label="Department" name="department" value={form.department} onChange={change} />
              <Input label="Current Year" type="number" name="current_year" value={form.current_year} onChange={change} min="1" max="6" />
              <Select label="College" name="collegeId" value={form.collegeId} onChange={change}>
                <option value="">— Select college —</option>
                {colleges.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
              <Select label="Status" name="status" value={form.status} onChange={change}>
                <option value="registered">Registered</option>
                <option value="verified">Verified</option>
                <option value="completed">Completed</option>
              </Select>
              <Input label="Wallet Balance (₹)" type="number" step="0.01" name="wallet_balance" value={form.wallet_balance} onChange={change} />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Student Photo</label>
                <input type="file" accept="image/*" disabled={photoBusy}
                  onChange={(e) => uploadPhoto(e.target.files?.[0])}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" />
                {photoBusy && <p className="mt-1 text-xs text-gray-500">Uploading…</p>}
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={closeEdit} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <Button type="submit" loading={saving}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setAdding(false)}>
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Student</h2>
              <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {addResult ? (
              <div className="space-y-3">
                <Alert type="success">Student added — Enrollment ID {addResult.enrollmentId}, Ref {addResult.referenceNo}.</Alert>
                {addResult.tempPassword && (
                  <div className="rounded-lg bg-purple-50 p-4 text-sm">
                    <p>Temporary password: <span className="font-mono font-bold">{addResult.tempPassword}</span></p>
                    <div className="mt-2 flex gap-2">
                      {addForm.phone && (
                        <a className="rounded bg-green-500 px-3 py-1.5 text-xs font-semibold text-white" target="_blank" rel="noreferrer"
                          href={waLink(addForm.phone, `Welcome to EduSkill, ${addForm.name}! Your login: ${addForm.email} | Password: ${addResult.tempPassword} | Login: ${loginUrl}`)}>Send via WhatsApp</a>
                      )}
                      <a className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                        href={mailLink(addForm.email, "Your EduSkill login", `Welcome ${addForm.name}!\n\nLogin: ${addForm.email}\nPassword: ${addResult.tempPassword}\nLogin here: ${loginUrl}`)}>Send via Email</a>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={openAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Add another</button>
                  <Button onClick={() => setAdding(false)}>Done</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {addError && (
                  <div className="sm:col-span-2">
                    <Alert type="error">{addError}</Alert>
                    <p className="mt-1 text-xs text-gray-500">Nothing was saved — your entries above are unchanged. Fix the issue if needed and try again.</p>
                  </div>
                )}
                <Input label="Name *" name="name" value={addForm.name} onChange={changeAdd} required />
                <Input label="Email *" type="email" name="email" value={addForm.email} onChange={changeAdd} required />
                <Input label="Phone" name="phone" value={addForm.phone} onChange={changeAdd} maxLength={10} placeholder="10-digit mobile" />
                <Input label="Roll Number" name="roll_number" value={addForm.roll_number} onChange={changeAdd} />
                <Select label="College" name="collegeId" value={addForm.collegeId} onChange={changeAdd}>
                  <option value="">— Select college —</option>
                  {colleges.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </Select>
                <Input label="Department" name="department" value={addForm.department} onChange={changeAdd} />
                <Input label="Aadhaar" name="aadhar" value={addForm.aadhar} onChange={changeAdd} maxLength={12} placeholder="12-digit" />
                <Input label="PAN" name="pan" value={addForm.pan} onChange={changeAdd} maxLength={10} placeholder="ABCDE1234F" />
                <Input label="Password (optional)" name="password" value={addForm.password} onChange={changeAdd} placeholder="Leave blank to auto-generate" />
                <div className="flex items-end text-xs text-gray-500">Leave password blank and we&apos;ll generate one to share.</div>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                  <Button type="submit" loading={addSaving}>{addError ? "Retry" : "Add Student"}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* IMPORT CSV MODAL */}
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setImporting(false)}>
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Import Students (CSV)</h2>
              <button onClick={() => setImporting(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              CSV header row should include: <span className="font-mono">name, email, phone, roll_number, current_year, college_id, department</span>.
            </p>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onCsvFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" />
            {importRows.length > 0 && (
              <p className="mt-3 text-sm text-gray-700">{importRows.length} rows parsed. Preview first 3:</p>
            )}
            {importRows.slice(0, 3).map((r, i) => (
              <div key={i} className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-600">{r.name} — {r.email} — {r.phone}</div>
            ))}
            {importResult && (
              <div className="mt-3">
                {importResult.error ? <Alert type="error">{importResult.error}</Alert> : <Alert type="success">{importResult.message}</Alert>}
                {importResult.errors && (
                  <div className="mt-2 max-h-32 overflow-y-auto text-xs text-red-600">
                    {importResult.errors.map((e, i) => <div key={i}>{e.email}: {e.error}</div>)}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImporting(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Close</button>
              <Button onClick={submitImport} loading={importBusy} disabled={!importRows.length}>Import {importRows.length || ""}</Button>
            </div>
          </div>
        </div>
      )}

      {/* SET PASSWORD MODAL */}
      {pwStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPwStudent(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Set Password</h2>
              <button onClick={() => setPwStudent(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="mb-3 text-sm text-gray-600">{pwStudent.name} — <span className="font-mono text-xs">{pwStudent.email}</span></p>
            {pwResult ? (
              pwResult.error ? <Alert type="error">{pwResult.error}</Alert> : (
                <div className="space-y-3">
                  <Alert type="success">{pwResult.message}</Alert>
                  {pwResult.password && (
                    <div className="rounded-lg bg-purple-50 p-4 text-sm">
                      <p>New password: <span className="font-mono font-bold">{pwResult.password}</span></p>
                      <div className="mt-2 flex gap-2">
                        {pwStudent.phone && (
                          <a className="rounded bg-green-500 px-3 py-1.5 text-xs font-semibold text-white" target="_blank" rel="noreferrer"
                            href={waLink(pwStudent.phone, `EduSkill login details — Login: ${pwStudent.email} | Password: ${pwResult.password} | ${loginUrl}`)}>Send via WhatsApp</a>
                        )}
                        <a className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                          href={mailLink(pwStudent.email, "Your EduSkill password", `Login: ${pwStudent.email}\nPassword: ${pwResult.password}\nLogin here: ${loginUrl}`)}>Send via Email</a>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end"><Button onClick={() => setPwStudent(null)}>Done</Button></div>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <Input label="New password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="Leave blank to auto-generate" />
                <p className="text-xs text-gray-500">Leave blank to generate a random password you can share via WhatsApp/email.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setPwStudent(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                  <Button onClick={submitPw} loading={pwBusy}>Set Password</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
