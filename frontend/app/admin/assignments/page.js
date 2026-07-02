"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const fileHref = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${api.base}${p}`);
const EMPTY = { title: "", description: "", due_date: "", max_marks: 100, submission_type: "both", audience: "all", course_id: "", program_id: "", batch_id: "" };

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState([]); // student ids for 'selected'
  const [studentQ, setStudentQ] = useState("");
  const [saving, setSaving] = useState(false);

  const [subFor, setSubFor] = useState(null); // assignment being viewed
  const [subs, setSubs] = useState([]);

  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/assignments", token()).then((d) => setAssignments(d.assignments || [])).catch((e) => setError(e.message));
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
    api.get("/api/batches", token()).then((d) => setBatches(d.batches || [])).catch(() => {});
    api.get("/api/students", token()).then((d) => setStudents(d.students || [])).catch(() => {});
  };
  useEffect(load, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setPicked([]); setStudentQ(""); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description, due_date: form.due_date || null,
        max_marks: form.max_marks, submission_type: form.submission_type, audience: form.audience,
        course_id: form.audience === "course" ? form.course_id : null,
        program_id: form.audience === "program" ? form.program_id : null,
        batch_id: form.audience === "batch" ? form.batch_id : null,
        student_ids: form.audience === "selected" ? picked : undefined,
      };
      if (form.audience === "course" && !payload.course_id) throw new Error("Pick a course.");
      if (form.audience === "program" && !payload.program_id) throw new Error("Pick a program.");
      if (form.audience === "batch" && !payload.batch_id) throw new Error("Pick a batch.");
      if (form.audience === "selected" && picked.length === 0) throw new Error("Select at least one student.");
      await api.post("/api/assignments", payload, token());
      setModal(false); notify.success("Assignment created & shared."); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!(await notify.confirm("Delete this assignment and its submissions?"))) return;
    try { await api.del(`/api/assignments/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const openSubs = async (a) => {
    setSubFor(a); setSubs([]);
    try { const d = await api.get(`/api/assignments/${a.id}/submissions`, token()); setSubs(d.submissions || []); }
    catch (e) { notify.error(e.message); }
  };
  const grade = async (s, marks, feedback, status) => {
    try {
      await api.put(`/api/assignments/${subFor.id}/submissions/${s.student_id}/grade`, { marks, feedback, status }, token());
      notify.success("Saved."); openSubs(subFor);
    } catch (e) { notify.error(e.message); }
  };

  const audienceLabel = (a) => {
    if (a.audience === "course") return `Course: ${a.course_title || "—"}`;
    if (a.audience === "program") return `Program: ${a.program_title || "—"}`;
    if (a.audience === "batch") return `Batch: ${a.batch_name || "—"}`;
    if (a.audience === "selected") return `${a.target_count || 0} selected`;
    return "All students";
  };

  const filteredStudents = useMemo(() =>
    students.filter((s) => [s.name, s.email, s.reference_no].join(" ").toLowerCase().includes(studentQ.toLowerCase())).slice(0, 50),
    [students, studentQ]);

  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <>
      <PageHeader title="Assignments" subtitle={`${assignments.length} total`} action={<Button onClick={openNew}>+ New Assignment</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Shared with</Th><Th>Due</Th><Th>Marks</Th><Th>Submissions</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {assignments.length === 0 ? (
            <tr><Td className="text-gray-500">No assignments yet.</Td></tr>
          ) : assignments.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <Td className="font-medium">{a.title}<div className="text-xs text-gray-400">{a.description?.slice(0, 60)}</div></Td>
              <Td className="text-xs">{audienceLabel(a)}</Td>
              <Td className="text-xs">{a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</Td>
              <Td>{a.max_marks || "—"}</Td>
              <Td>{a.total_submissions || 0}</Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openSubs(a)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Submissions</button>
                  <button onClick={() => remove(a.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {/* Create modal */}
      <Modal open={modal} title="New Assignment" onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
            <textarea name="description" value={form.description} onChange={change} rows={3}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Due Date" type="datetime-local" name="due_date" value={form.due_date} onChange={change} />
            <Input label="Max Marks" type="number" name="max_marks" value={form.max_marks} onChange={change} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Submission Type" name="submission_type" value={form.submission_type} onChange={change}>
              <option value="both">File or Text</option>
              <option value="file">File only</option>
              <option value="text">Text only</option>
            </Select>
            <Select label="Share with" name="audience" value={form.audience} onChange={change}>
              <option value="all">All students</option>
              <option value="course">A course</option>
              <option value="program">A program</option>
              <option value="batch">A batch</option>
              <option value="selected">Selected students</option>
            </Select>
          </div>

          {form.audience === "course" && (
            <Select label="Course" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— Select —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          )}
          {form.audience === "program" && (
            <Select label="Program" name="program_id" value={form.program_id} onChange={change}>
              <option value="">— Select —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          )}
          {form.audience === "batch" && (
            <Select label="Batch" name="batch_id" value={form.batch_id} onChange={change}>
              <option value="">— Select —</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          {form.audience === "selected" && (
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Students ({picked.length} selected)</span>
              <input value={studentQ} onChange={(e) => setStudentQ(e.target.value)} placeholder="Search students…"
                className="mb-2 w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 divide-y">
                {filteredStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                    {s.name} <span className="text-xs text-gray-400">{s.reference_no}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" loading={saving} className="w-full">Create & Share</Button>
        </form>
      </Modal>

      {/* Submissions modal */}
      <Modal open={!!subFor} title={`Submissions — ${subFor?.title || ""}`} onClose={() => setSubFor(null)}>
        {subs.length === 0 ? (
          <p className="text-sm text-gray-500">No submissions yet.</p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {subs.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.student_name} <span className="text-xs text-gray-400">{s.reference_no}</span></span>
                  <StatusBadge status={s.status} />
                </div>
                {s.text_answer && <p className="mt-1 text-sm text-gray-600">{s.text_answer}</p>}
                {s.file_url && <a href={fileHref(s.file_url)} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">View file</a>}
                <GradeRow s={s} onGrade={grade} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function GradeRow({ s, onGrade }) {
  const [marks, setMarks] = useState(s.marks ?? "");
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [status, setStatus] = useState(s.status || "approved");
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-2">
      <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Marks"
        className="w-20 rounded border border-gray-200 px-2 py-1 text-sm" />
      <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback"
        className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm" />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-gray-200 px-2 py-1 text-sm">
        <option value="approved">Approved</option>
        <option value="revision">Needs revision</option>
        <option value="rejected">Rejected</option>
        <option value="pending">Pending</option>
      </select>
      <button onClick={() => onGrade(s, marks, feedback, status)} className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white">Save</button>
    </div>
  );
}
