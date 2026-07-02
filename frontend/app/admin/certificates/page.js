"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { student_id: "", grant_type: "program", program_id: "", course_id: "", issued_date: "" };

export default function AdminCertificates() {
  const [certs, setCerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/certificates", token()).then((d) => setCerts(d.certificates || [])).catch((e) => setError(e.message));
    api.get("/api/students", token()).then((d) => setStudents(d.students || [])).catch(() => {});
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setModal(true); };

  const generate = async (e) => {
    e.preventDefault();
    if (!form.student_id) { notify.toast("Select a student."); return; }
    const payload = {
      student_id: form.student_id,
      issued_date: form.issued_date || undefined,
      program_id: form.grant_type === "program" ? form.program_id || null : null,
      course_id: form.grant_type === "course" ? form.course_id || null : null,
    };
    if (form.grant_type === "program" && !payload.program_id) { notify.toast("Select a program."); return; }
    if (form.grant_type === "course" && !payload.course_id) { notify.toast("Select a course."); return; }
    setSaving(true);
    try {
      await api.post("/api/certificates/generate", payload, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };

  const revoke = async (id) => {
    if (!(await notify.confirm("Revoke this certificate? It will show as invalid on verification."))) return;
    try { await api.del(`/api/certificates/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const filtered = certs.filter((c) =>
    [c.certificate_no, c.student_name, c.reference_no, c.course_title, c.program_title]
      .join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Certificates" subtitle={`${certs.length} issued`} action={
        <div className="flex gap-2">
          <Link href="/admin/certificates/templates"><Button className="bg-gray-600 hover:bg-gray-700">Templates</Button></Link>
          <Button onClick={openNew}>+ Issue Certificate</Button>
        </div>
      } />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-3">
        <Input placeholder="Search by name, cert no, course…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Certificate No</Th><Th>Student</Th><Th>For</Th><Th>Issued</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No certificates issued yet.</Td></tr>
          ) : filtered.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <Td className="font-mono text-xs">{c.certificate_no}</Td>
              <Td className="font-medium">{c.student_name}<div className="text-xs text-gray-400">{c.reference_no}</div></Td>
              <Td>{c.program_title || c.course_title || "—"}</Td>
              <Td>{c.issued_date ? new Date(c.issued_date).toLocaleDateString() : "—"}</Td>
              <Td><StatusBadge status={c.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  <a href={`/verify/${c.certificate_no}`} target="_blank" rel="noreferrer" className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">View</a>
                  {c.status !== "revoked" && (
                    <button onClick={() => revoke(c.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Revoke</button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title="Issue Certificate" onClose={() => setModal(false)}>
        <form onSubmit={generate} className="space-y-3">
          <Select label="Student *" name="student_id" value={form.student_id} onChange={change} required>
            <option value="">— Select student —</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.reference_no})</option>)}
          </Select>
          <Select label="Certificate For" name="grant_type" value={form.grant_type} onChange={change}>
            <option value="program">Program</option>
            <option value="course">Course</option>
          </Select>
          {form.grant_type === "program" ? (
            <Select label="Program *" name="program_id" value={form.program_id} onChange={change}>
              <option value="">— Select program —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          ) : (
            <Select label="Course *" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— Select course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          )}
          <Input label="Issue Date" type="date" name="issued_date" value={form.issued_date} onChange={change} />
          <Button type="submit" loading={saving} className="w-full">Issue Certificate</Button>
        </form>
      </Modal>
    </>
  );
}
