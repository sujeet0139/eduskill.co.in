"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { name: "", course_id: "", program_id: "", mentor_id: "", teacher_id: "", start_date: "", end_date: "", max_students: 30, status: "open" };

export default function AdminBatches() {
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/batches", token()).then((d) => setBatches(d.batches || [])).catch((e) => setError(e.message));
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
    api.get("/api/faculty", token()).then((d) => setFaculty(d.faculty || [])).catch(() => {});
    api.get("/api/teachers?limit=200", token()).then((d) => setTeachers(d.teachers || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (b) => {
    setForm({ ...EMPTY, ...b, course_id: b.course_id || "", program_id: b.program_id || "", mentor_id: b.mentor_id || "", teacher_id: b.teacher_id || "",
      start_date: (b.start_date || "").slice(0, 10), end_date: (b.end_date || "").slice(0, 10) });
    setEditId(b.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date)) {
      notify.error("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      if (editId) await api.put(`/api/batches/${editId}`, form, token());
      else await api.post("/api/batches", form, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this batch?"))) return;
    try { await api.del(`/api/batches/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Batches" subtitle={`${batches.length} total`} action={<Button onClick={openNew}>+ New Batch</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>Course / Program</Th><Th>Mentor</Th><Th>Teacher</Th><Th>Dates</Th><Th>Seats</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {batches.length === 0 ? (
            <tr><Td className="text-gray-500">No batches yet.</Td></tr>
          ) : batches.map((b) => (
            <tr key={b.id} className="hover:bg-gray-50">
              <Td className="font-medium">{b.name}</Td>
              <Td>{b.course_title || b.program_title || "—"}</Td>
              <Td>{b.mentor_name || "—"}</Td>
              <Td>{b.teacher_name || "—"}</Td>
              <Td className="text-xs">{b.start_date ? new Date(b.start_date).toLocaleDateString() : "—"} → {b.end_date ? new Date(b.end_date).toLocaleDateString() : "—"}</Td>
              <Td>{b.current_enrolled || 0}/{b.max_students}</Td>
              <Td><StatusBadge status={b.status === "open" ? "active" : b.status === "completed" ? "completed" : b.status === "cancelled" ? "revoked" : "pending"} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(b.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Batch" : "New Batch"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Batch Name *" name="name" value={form.name} onChange={change} required placeholder="e.g., Web Dev — Jan 2026" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Course" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— None —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Select label="Program" name="program_id" value={form.program_id} onChange={change}>
              <option value="">— None —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Mentor" name="mentor_id" value={form.mentor_id} onChange={change}>
              <option value="">— None —</option>
              {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
            <Select label="Teacher (portal login)" name="teacher_id" value={form.teacher_id} onChange={change}>
              <option value="">— None —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <p className="text-xs text-gray-500">
            Teacher determines who can mark attendance / upload materials for this batch via the teacher portal.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" name="start_date" value={form.start_date} onChange={change} />
            <Input label="End Date" type="date" name="end_date" value={form.end_date} onChange={change} min={form.start_date || undefined} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Students" type="number" name="max_students" value={form.max_students} onChange={change} />
            <Select label="Status" name="status" value={form.status} onChange={change}>
              <option value="open">Open</option>
              <option value="full">Full</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          <Button type="submit" loading={saving} className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
