"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { teacherAuth } from "@/lib/auth";
import { ImageUploadField } from "@/components/ImageUploadField";

const fileHref = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${api.base}${p}`);
const EMPTY = { title: "", description: "", due_date: "", max_marks: 100, submission_type: "both", audience: "all", course_id: "", program_id: "", batch_id: "" };
const badge = { approved: "bg-green-100 text-green-700", revision: "bg-amber-100 text-amber-700", rejected: "bg-red-100 text-red-700", pending: "bg-blue-100 text-blue-700" };

const TABS = [
  { id: "batches", label: "My Batches" },
  { id: "assignments", label: "Assignments" },
  { id: "profile", label: "Profile" },
];

// Shared across every tab's data loads: an expired/invalid token should
// bounce back to login instead of each tab silently showing an empty state
// (this used to only be checked on the assignments fetch before the tabs
// existed as separate components).
function isAuthError(message) {
  return String(message).includes("Unauthorized") || String(message).includes("token");
}

export default function TeacherPortal() {
  const router = useRouter();
  const [teacher, setTeacher] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("batches");

  const token = () => teacherAuth.token();

  useEffect(() => {
    if (!teacherAuth.token()) { router.replace("/teacher/login"); return; }
    setTeacher(teacherAuth.teacher());
    setReady(true);
  }, []);

  const logout = async () => { try { await api.post("/api/auth/logout"); } catch {} teacherAuth.logout(); router.push("/teacher/login"); };

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

      <div className="border-b bg-white px-6">
        <nav className="mx-auto flex max-w-5xl gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 py-3 text-sm font-medium ${tab === t.id ? "border-indigo-700 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === "batches" && <MyBatchesTab token={token} />}
        {tab === "assignments" && <AssignmentsTab token={token} />}
        {tab === "profile" && <ProfileTab token={token} onUpdated={(t) => setTeacher((prev) => ({ ...prev, ...t }))} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROFILE (item #27 -- expertise, contact, bio, photo)
// ---------------------------------------------------------------------------
function ProfileTab({ token, onUpdated }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pwValue, setPwValue] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    api.get("/api/teacher-portal/profile", token()).then((d) => setProfile(d.teacher)).catch((e) => {
      if (isAuthError(e.message)) { teacherAuth.logout(); router.replace("/teacher/login"); return; }
      setError(e.message);
    });
  }, []);

  const change = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      await api.put("/api/teacher-portal/profile", profile, token());
      setSuccess("Profile updated.");
      onUpdated(profile);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (pwValue.length < 6) { setError("Password must be at least 6 characters."); return; }
    setPwSaving(true); setError(""); setSuccess("");
    try {
      await api.put("/api/teacher-portal/profile/password", { password: pwValue }, token());
      setSuccess("Password changed.");
      setPwValue("");
    } catch (err) { setError(err.message); }
    finally { setPwSaving(false); }
  };

  if (!profile) return error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">My Profile</h2>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex items-center gap-4">
        {profile.profile_photo && <img src={api.mediaUrl(profile.profile_photo)} alt="" className="h-16 w-16 rounded-full object-cover" />}
        <div className="flex-1">
          <ImageUploadField
            uploadUrl="/api/teacher-portal/profile/photo"
            fieldName="photo"
            token={token()}
            onUploaded={(url) => setProfile((p) => ({ ...p, profile_photo: url }))}
            hint="Profile photo, max 2 MB."
          />
        </div>
      </div>

      <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <input value={profile.name || ""} disabled className="w-full rounded-lg border-2 border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
          <p className="mt-1 text-xs text-gray-400">Set by admin.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input value={profile.email || ""} disabled className="w-full rounded-lg border-2 border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
          <input name="subject" value={profile.subject || ""} onChange={change} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Mobile</label>
          <input name="mobile" value={profile.mobile || ""} onChange={change} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Qualification</label>
          <input name="qualification" value={profile.qualification || ""} onChange={change} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Experience</label>
          <input name="experience" value={profile.experience || ""} onChange={change} placeholder="e.g., 5 years" className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Expertise</label>
          <input name="expertise" value={profile.expertise || ""} onChange={change} placeholder="e.g., Python, Data Science" className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
          <textarea name="bio" value={profile.bio || ""} onChange={change} rows={3} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:bg-gray-400 md:col-span-2">
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>

      <div className="mt-6 border-t pt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Change Password</label>
        <div className="flex gap-2">
          <input type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="New password"
            className="flex-1 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none" />
          <button onClick={changePassword} disabled={pwSaving} className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
            {pwSaving ? "Saving…" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MY BATCHES -- roster / attendance / materials (item #27)
// ---------------------------------------------------------------------------
function MyBatchesTab({ token }) {
  const router = useRouter();
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/api/teacher-portal/my-batches", token()).then((d) => setBatches(d.batches || [])).catch((e) => {
      if (isAuthError(e.message)) { teacherAuth.logout(); router.replace("/teacher/login"); return; }
      setError(e.message);
    });
  }, []);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">My Batches</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-gray-500">No batches assigned to you yet. Ask an admin to assign you to a batch.</p>
        ) : (
          <div className="divide-y">
            {batches.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.course_title || b.program_title || "—"} · {b.current_enrolled || 0}/{b.max_students} students</p>
                </div>
                <button onClick={() => setSelected(b)} className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                  Manage
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <BatchDetail batch={selected} token={token} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BatchDetail({ batch, token, onClose }) {
  const [subTab, setSubTab] = useState("roster");
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState("");

  const load = () => {
    api.get(`/api/teacher-portal/batches/${batch.id}/students`, token()).then((d) => setStudents(d.students || [])).catch((e) => setError(e.message));
    api.get(`/api/teacher-portal/batches/${batch.id}/sessions`, token()).then((d) => setSessions(d.sessions || [])).catch(() => {});
    api.get(`/api/teacher-portal/batches/${batch.id}/materials`, token()).then((d) => setMaterials(d.materials || [])).catch(() => {});
    api.get(`/api/teacher-portal/batches/${batch.id}/syllabus`, token()).then((d) => setTopics(d.topics || [])).catch(() => {});
  };
  useEffect(load, [batch.id]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{batch.name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex gap-4 border-b">
        {["roster", "sessions", "materials", "syllabus"].map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`pb-2 text-sm font-medium capitalize ${subTab === t ? "border-b-2 border-indigo-700 text-indigo-700" : "text-gray-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {subTab === "roster" && (
        <div className="max-h-64 overflow-y-auto">
          {students.length === 0 ? <p className="text-sm text-gray-500">No students in this batch yet.</p> : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {students.map((s) => (
                  <tr key={s.id}><td className="py-1.5 font-medium">{s.name}</td><td className="py-1.5 text-gray-500">{s.reference_no}</td><td className="py-1.5 text-gray-500">{s.phone}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subTab === "sessions" && <SessionsPanel batch={batch} sessions={sessions} students={students} token={token} onChanged={load} />}

      {subTab === "materials" && <MaterialsPanel batch={batch} materials={materials} token={token} onChanged={load} />}

      {subTab === "syllabus" && <SyllabusPanel batch={batch} topics={topics} token={token} onChanged={load} />}
    </div>
  );
}

// One-tap syllabus checklist (master-dev-prompt Section G item 2). Topics
// are defined once per Course (admin-managed); tapping a status here cycles
// it for THIS batch only, so the same course's topic list is reused across
// every batch taking it.
const STATUS_CYCLE = { not_started: "in_progress", in_progress: "completed", completed: "not_started" };
const STATUS_LABEL = { not_started: "⚪ Not started", in_progress: "🟡 In progress", completed: "🟢 Completed" };

function SyllabusPanel({ batch, topics, token, onChanged }) {
  const [busyId, setBusyId] = useState(null);

  const tap = async (topic) => {
    setBusyId(topic.id);
    try {
      await api.put(`/api/teacher-portal/batches/${batch.id}/syllabus/${topic.id}`, { status: STATUS_CYCLE[topic.status] }, token());
      onChanged();
    } catch (err) { alert(err.message); }
    finally { setBusyId(null); }
  };

  if (topics.length === 0) {
    return <p className="text-sm text-gray-500">No syllabus topics defined for this course yet -- ask an admin to add them under Admin → Syllabus.</p>;
  }
  return (
    <div className="divide-y">
      {topics.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{t.title}</span>
          <button onClick={() => tap(t)} disabled={busyId === t.id}
            className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium hover:bg-gray-200 disabled:opacity-50">
            {STATUS_LABEL[t.status]}
          </button>
        </div>
      ))}
    </div>
  );
}

function SessionsPanel({ batch, sessions, students, token, onChanged }) {
  const [form, setForm] = useState({ title: "", topic: "", scheduled_at: "" });
  const [creating, setCreating] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const createSession = async (e) => {
    e.preventDefault();
    if (!form.title || !form.scheduled_at) return;
    setCreating(true);
    try {
      await api.post(`/api/teacher-portal/batches/${batch.id}/sessions`, form, token());
      setForm({ title: "", topic: "", scheduled_at: "" });
      onChanged();
    } catch (err) { alert(err.message); }
    finally { setCreating(false); }
  };

  const openAttendance = async (session) => {
    setAttendanceFor(session);
    try {
      const d = await api.get(`/api/teacher-portal/sessions/${session.id}/attendance`, token());
      setAttendance(d.attendance || []);
    } catch { setAttendance(students.map((s) => ({ student_id: s.id, name: s.name, status: null }))); }
  };
  const setStatus = (studentId, status) => setAttendance((prev) => prev.map((a) => a.student_id === studentId ? { ...a, status } : a));
  const saveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const records = attendance.filter((a) => a.status).map((a) => ({ student_id: a.student_id, status: a.status }));
      await api.post(`/api/teacher-portal/sessions/${attendanceFor.id}/attendance`, { records }, token());
      setAttendanceFor(null);
    } catch (err) { alert(err.message); }
    finally { setSavingAttendance(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={createSession} className="flex flex-wrap items-end gap-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Session title" required
          className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
        <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Topic (optional)"
          className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
        <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required
          className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
        <button type="submit" disabled={creating} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800">
          + New Session
        </button>
      </form>

      {sessions.length === 0 ? <p className="text-sm text-gray-500">No sessions yet.</p> : (
        <div className="divide-y">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-gray-500">{new Date(s.scheduled_at).toLocaleString()}</p>
              </div>
              <button onClick={() => openAttendance(s)} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium hover:bg-gray-200">Mark Attendance</button>
            </div>
          ))}
        </div>
      )}

      {attendanceFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setAttendanceFor(null)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="mb-3 font-semibold">Attendance — {attendanceFor.title}</h4>
            <div className="space-y-2">
              {attendance.map((a) => (
                <div key={a.student_id} className="flex items-center justify-between">
                  <span className="text-sm">{a.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setStatus(a.student_id, "present")} className={`rounded px-2 py-1 text-xs ${a.status === "present" ? "bg-green-600 text-white" : "bg-gray-100"}`}>Present</button>
                    <button onClick={() => setStatus(a.student_id, "absent")} className={`rounded px-2 py-1 text-xs ${a.status === "absent" ? "bg-red-600 text-white" : "bg-gray-100"}`}>Absent</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={saveAttendance} disabled={savingAttendance} className="mt-4 w-full rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
              {savingAttendance ? "Saving…" : "Save Attendance"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialsPanel({ batch, materials, token, onChanged }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async (e) => {
    e.preventDefault();
    if (!title || !(file || videoUrl)) { alert("Title and either a file or a YouTube link are required."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", description);
      if (file) fd.append("document", file);
      if (videoUrl) fd.append("video_url", videoUrl);
      await api.postForm(`/api/teacher-portal/batches/${batch.id}/materials`, fd, token());
      setTitle(""); setDescription(""); setFile(null); setVideoUrl("");
      onChanged();
    } catch (err) { alert(err.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={upload} className="space-y-2 rounded-lg border border-gray-100 p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Material title" required
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-700 file:px-3 file:py-1.5 file:text-white" />
        <p className="text-center text-xs text-gray-400">— or —</p>
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste a YouTube video link"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm" />
        <button type="submit" disabled={uploading} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800">
          {uploading ? "Sharing…" : "Share"}
        </button>
      </form>
      {materials.length === 0 ? <p className="text-sm text-gray-500">No materials for this batch yet.</p> : (
        <div className="divide-y">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{m.title} {m.video_url && <span className="ml-1 text-xs text-red-600">▶ video</span>}</span>
              <a href={m.video_url || fileHref(m.file_path)} target="_blank" rel="noreferrer" className="text-xs text-indigo-700 hover:underline">View</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASSIGNMENTS -- unchanged from before, just moved into its own tab.
// ---------------------------------------------------------------------------
function AssignmentsTab({ token }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ courses: [], programs: [], batches: [], students: [] });
  const [assignments, setAssignments] = useState([]);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState([]);
  const [studentQ, setStudentQ] = useState("");
  const [saving, setSaving] = useState(false);

  const [subFor, setSubFor] = useState(null);
  const [subs, setSubs] = useState([]);

  const load = () => {
    api.get("/api/teacher-portal/assignments", token()).then((d) => setAssignments(d.assignments || [])).catch((e) => {
      if (isAuthError(e.message)) { teacherAuth.logout(); router.replace("/teacher/login"); }
    });
    api.get("/api/teacher-portal/meta", token()).then(setMeta).catch(() => {});
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

  return (
    <>
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
    </>
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
