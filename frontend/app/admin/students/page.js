"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { StatusBadge, Input, Select, Button, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";

// Fields the PUT /api/students/:id endpoint accepts.
const blankEdit = {
  name: "", email: "", phone: "", collegeId: "", department: "",
  status: "registered", roll_number: "", current_year: 1, wallet_balance: 0,
};

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

  const token = () => adminAuth.token();

  const load = () => {
    setLoading(true);
    api.get("/api/students", token())
      .then((d) => setStudents(d.students || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Colleges for the edit dropdown (best-effort).
    api.get("/api/colleges", token())
      .then((d) => setColleges(d.colleges || []))
      .catch(() => {});
  }, []);

  const verify = async (id) => {
    try { await api.put(`/api/students/${id}/verify`, {}, token()); load(); }
    catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    try { await api.del(`/api/students/${id}`, token()); load(); }
    catch (e) { alert(e.message); }
  };

  const exportStudents = async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`${api.base}/api/students/export?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token()}`,
        },
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
      link.download = `eduskill-students-${new Date().toISOString().slice(0,10)}.csv`;
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

  const openEdit = (s) => {
    setEditError("");
    setEditing(s);
    setForm({
      name: s.name || "",
      email: s.email || "",
      phone: s.phone || "",
      collegeId: s.college_id || "",
      department: s.department || "",
      status: s.status || "registered",
      roll_number: s.roll_number || "",
      current_year: s.current_year || 1,
      wallet_balance: s.wallet_balance || 0,
    });
  };

  const closeEdit = () => { setEditing(null); setForm(blankEdit); setEditError(""); };

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setEditError("");
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

  const filtered = students.filter((s) =>
    [s.name, s.email, s.reference_no, s.phone].join(" ").toLowerCase().includes(q.toLowerCase())
  );

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
            <Button onClick={exportStudents} loading={exporting} className="whitespace-nowrap">
              Export CSV
            </Button>
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
                <Link href={`/admin/students/${s.id}`} className="text-brand hover:underline">
                  {s.name}
                </Link>
              </Td>
              <Td>{s.email}</Td>
              <Td>{s.phone}</Td>
              <Td className="max-w-[180px] truncate" >{s.college_name}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">
                    Edit
                  </button>
                  {s.status !== "verified" && (
                    <button onClick={() => verify(s.id)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">
                      Verify
                    </button>
                  )}
                  <button onClick={() => remove(s.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {/* EDIT STUDENT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeEdit}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Student</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="mb-4 text-xs text-gray-500">Ref: <span className="font-mono">{editing.reference_no}</span></p>
            <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editError && <div className="sm:col-span-2"><Alert type="error">{editError}</Alert></div>}
              <Input label="Name" name="name" value={form.name} onChange={change} required />
              <Input label="Email" type="email" name="email" value={form.email} onChange={change} required />
              <Input label="Phone" name="phone" value={form.phone} onChange={change} required />
              <Input label="Roll Number" name="roll_number" value={form.roll_number} onChange={change} />
              <Input label="Department" name="department" value={form.department} onChange={change} />
              <Input label="Current Year" type="number" name="current_year" value={form.current_year} onChange={change} min="1" max="6" />
              <Select label="College" name="collegeId" value={form.collegeId} onChange={change}>
                <option value="">— Select college —</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Select label="Status" name="status" value={form.status} onChange={change}>
                <option value="registered">Registered</option>
                <option value="verified">Verified</option>
                <option value="completed">Completed</option>
              </Select>
              <Input label="Wallet Balance (₹)" type="number" step="0.01" name="wallet_balance" value={form.wallet_balance} onChange={change} />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={closeEdit} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <Button type="submit" loading={saving}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
