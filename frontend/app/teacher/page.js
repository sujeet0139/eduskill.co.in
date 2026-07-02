"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { teacherAuth } from "@/lib/auth";

const fileHref = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${api.base}${p}`);
const EMPTY = { title: "", description: "", due_date: "", max_marks: 100, submission_type: "both", audience: "all", course_id: "", program_id: "", batch_id: "" };
const badge = { approved: "bg-green-100 text-green-700", revision: "bg-amber-100 text-amber-700", rejected: "bg-red-100 text-red-700", pending: "bg-blue-100 text-blue-700" };

export default function TeacherPortal() {
  const router = useRouter();
  const [teacher, setTeacher] = useState(null);
  const [meta, setMeta] = useState({ courses: [], programs: [], batches: [], students: [] });
  const [assignments, setAssignments] = useState([]);
  const [ready, setReady] = useState(false);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState([]);
  const [studentQ, setStudentQ] = useState("");
  const [saving, setSaving] = useState(false);

  const [subFor, setSubFor] = useState(null);
  const [subs, setSubs] = useState([]);

  const token = () => teacherAuth.token();

  useEffect(() => {
    if (!teacherAuth.token()) { router.replace("/teacher/login"); return; }
    setTeacher(teacherAuth.teacher());
    load();
    setReady(true);
  }, []);

  const load = () => {
    api.get("/api/teacher-portal/assignments", token()).then((d) => setAssignments(d.assignments || [])).catch((e) => {
      if (String(e.message).includes("Unauthorized") || String(e.message).includes("token")) { teacherAuth.logout(); router.replace("/teacher/login"); }
    });
    api.get("/api/teacher-portal/meta", token()).then(setMeta).catch(() => {});
  };

  const logout = async () => { try { await api.post("/api/auth/logout"); } catch {} teacherAuth.logout(); router.push("/teacher/login"); };

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
      await api.post("/api/teacher-portal/assignments", payload, token());
      setModal(false); load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const openSubs = async (a) => {
    setSubFor(a); setSubs([]);
    try { const d = await api.get(`/api/teacher-portal/assignments/${a.id}/submissions`, token()); setSubs(d.submissions || []); }
    catch (e) { alert(e.message); }
  };
  const grade = async (s, marks, feedback, status) => {
    try { await api.put(`/api/teacher-portal/assignments/${subFor.id}/submissions/${s.student_id}/grade`, { marks, feedback, status }, token()); openSubs(subFor); }
    catch (e) { alert(e.message); }
  };

  const audienceLabel = (a) => {
    if (a.audience === "course") return `Course: ${a.course_title || "—"}`;
    if (a.audience === "program") return `Program: ${a.program_title || "—"}`;
    if (a.audience === "batch") return `Batch: ${a.batch_name || "—"}`;
    if (a.audience === "selected") return `${a.target_count || 0} selected`;
    return "All students";
  };
  const filteredStudents = useMemo(() =>
    meta.students.filter((s) => [s.name, s.reference_no].join(" ").toLowerCase().includes(studentQ.toLowerCase())).slice(0, 50),
    [meta.students, studentQ]);
  const toggle = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="text-lg font-bold text-indigo-800">EduSkill <span className="text-gray-900">Teacher</span></div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{teacher?.name || teacher?.email}</span>
          <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">Logout</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
            <p className="text-sm text-gray-500">Share assignments with your students and grade their submissions.</p>
          </div>
          <button onClick={openNew} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">+ New Assignment</button>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Shared with</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Submissions</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {assignments.length === 0 ? (
                <tr><td className="px-4 py-3 text-gray-500" colSpan={5}>No assignments yet.</td></tr>
              ) : assignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3 text-xs">{audienceLabel(a)}</td>
                  <td className="px-4 py-3 text-xs">{a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">{a.total_submissions || 0}</td>
                  <td className="px-4 py-3"><button onClick={() => openSubs(a)} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200">Submissions</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create modal */}
      {modal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">New Assignment</h2><button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-700">✕</button></div>
            <form onSubmit={save} className="space-y-3">
              <input name="title" value={form.title} onChange={change} required placeholder="Title"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
              <textarea name="description" value={form.description} onChange={change} rows={3} placeholder="Description"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" name="due_date" value={form.due_date} onChange={change} className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm" />
                <input type="number" name="max_marks" value={form.max_marks} onChange={change} placeholder="Max marks" className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select name="submission_type" value={form.submission_type} onChange={change} className="rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="both">File or Text</option><option value="file">File only</option><option value="text">Text only</option>
                </select>
                <select name="audience" value={form.audience} onChange={change} className="rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="all">All students</option><option value="course">A course</option><option value="program">A program</option><option value="batch">A batch</option><option value="selected">Selected students</option>
                </select>
              </div>
              {form.audience === "course" && (
                <select name="course_id" value={form.course_id} onChange={change} className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Select course —</option>{meta.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              )}
              {form.audience === "program" && (
                <select name="program_id" value={form.program_id} onChange={change} className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Select program —</option>{meta.programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              )}
              {form.audience === "batch" && (
                <select name="batch_id" value={form.batch_id} onChange={change} className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Select batch —</option>{meta.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {form.audience === "selected" && (
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Students ({picked.length} selected)</div>
                  <input value={studentQ} onChange={(e) => setStudentQ(e.target.value)} placeholder="Search students…" className="mb-2 w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
                  <div className="max-h-40 divide-y overflow-y-auto rounded-lg border border-gray-100">
                    {filteredStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
                        <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />{s.name} <span className="text-xs text-gray-400">{s.reference_no}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:bg-gray-400">{saving ? "Sharing…" : "Create & Share"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Submissions modal */}
      {subFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setSubFor(null)}>
          <div className="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Submissions — {subFor.title}</h2><button onClick={() => setSubFor(null)} className="text-gray-400 hover:text-gray-700">✕</button></div>
            {subs.length === 0 ? <p className="text-sm text-gray-500">No submissions yet.</p> : (
              <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                {subs.map((s) => (
                  <div key={s.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.student_name} <span className="text-xs text-gray-400">{s.reference_no}</span></span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[s.status] || "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                    </div>
                    {s.text_answer && <p className="mt-1 text-sm text-gray-600">{s.text_answer}</p>}
                    {s.file_url && <a href={fileHref(s.file_url)} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 hover:underline">View file</a>}
                    <GradeRow s={s} onGrade={grade} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GradeRow({ s, onGrade }) {
  const [marks, setMarks] = useState(s.marks ?? "");
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [status, setStatus] = useState(s.status || "approved");
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-2">
      <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Marks" className="w-20 rounded border border-gray-200 px-2 py-1 text-sm" />
      <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback" className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm" />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-gray-200 px-2 py-1 text-sm">
        <option value="approved">Approved</option><option value="revision">Needs revision</option><option value="rejected">Rejected</option><option value="pending">Pending</option>
      </select>
      <button onClick={() => onGrade(s, marks, feedback, status)} className="rounded bg-indigo-700 px-3 py-1 text-sm font-semibold text-white">Save</button>
    </div>
  );
}
