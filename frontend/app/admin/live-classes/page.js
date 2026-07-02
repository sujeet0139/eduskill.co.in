"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = {
  title: "", topic: "", mentor_id: "", course_id: "", college_id: "",
  scheduled_at: "", duration_minutes: 60, meet_link: "", max_students: 100, status: "scheduled",
};

export default function AdminLiveClasses() {
  const [classes, setClasses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/live-classes", token()).then((d) => setClasses(d.classes || [])).catch((e) => setError(e.message));
    api.get("/api/faculty", token()).then((d) => setFaculty(d.faculty || [])).catch(() => {});
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/colleges", token()).then((d) => setColleges(d.colleges || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (c) => {
    setForm({ ...EMPTY, ...c, mentor_id: c.mentor_id || "", course_id: c.course_id || "", college_id: c.college_id || "",
      scheduled_at: c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0, 16) : "" });
    setEditId(c.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await api.put(`/api/live-classes/${editId}`, form, token());
      else await api.post("/api/live-classes", form, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };

  // Open WhatsApp with a pre-filled class invite (admin picks the recipient/group).
  const shareWhatsApp = (c) => {
    const when = c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "soon";
    const text = `📚 Live Class: ${c.title}\n${c.topic ? `Topic: ${c.topic}\n` : ""}🕒 ${when}\n🔗 Join: ${c.meet_link || "(link to be shared)"}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  // Email the meeting link to all registered (verified) students for this class.
  const emailLink = async (c) => {
    if (!c.meet_link) { notify.toast("Add a meeting link to this class first."); return; }
    if (!(await notify.confirm("Email the meeting link to all registered students for this class?"))) return;
    try {
      const res = await api.post(`/api/live-classes/${c.id}/notify-link`, {}, token());
      notify.success(res.message || "Sent.");
    } catch (err) { notify.error(err.message); }
  };

  return (
    <>
      <PageHeader title="Live Classes" subtitle={`${classes.length} scheduled`} action={<Button onClick={openNew}>+ Schedule Class</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Mentor</Th><Th>When</Th><Th>Present</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {classes.length === 0 ? (
            <tr><Td className="text-gray-500">No classes scheduled.</Td></tr>
          ) : classes.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <Td className="font-medium">{c.title}<div className="text-xs text-gray-400">{c.topic}</div></Td>
              <Td>{c.mentor_name || "—"}</Td>
              <Td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "—"}</Td>
              <Td>{c.present_count ?? 0}</Td>
              <Td><StatusBadge status={c.status === "completed" ? "completed" : c.status === "cancelled" ? "revoked" : "active"} /></Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {c.meet_link && <a href={c.meet_link} target="_blank" rel="noreferrer" className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Join</a>}
                  <button onClick={() => shareWhatsApp(c)} className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200">WhatsApp</button>
                  <button onClick={() => emailLink(c)} className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 hover:bg-orange-200">Email Link</button>
                  <button onClick={() => openEdit(c)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Class" : "Schedule Live Class"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <Input label="Topic" name="topic" value={form.topic} onChange={change} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Mentor" name="mentor_id" value={form.mentor_id} onChange={change}>
              <option value="">— None —</option>
              {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
            <Select label="Course" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— None —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>
          <Select label="Target College (optional)" name="college_id" value={form.college_id} onChange={change}>
            <option value="">— All colleges —</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date & Time *" type="datetime-local" name="scheduled_at" value={form.scheduled_at} onChange={change} required />
            <Input label="Duration (min)" type="number" name="duration_minutes" value={form.duration_minutes} onChange={change} />
          </div>
          <Input label="Meeting Link" name="meet_link" value={form.meet_link} onChange={change} placeholder="https://meet.google.com/..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Students" type="number" name="max_students" value={form.max_students} onChange={change} />
            {editId && (
              <Select label="Status" name="status" value={form.status} onChange={change}>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            )}
          </div>
          <Button type="submit" loading={saving} className="w-full">{editId ? "Update" : "Schedule"}</Button>
        </form>
      </Modal>
    </>
  );
}
