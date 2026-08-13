"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal, Pagination } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { title: "", description: "", category: "", subject: "", course_id: "", program_id: "" };

export default function AdminMaterials() {
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [filter, setFilter] = useState({ course_id: "", program_id: "", q: "" });
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () =>
    api.get("/api/materials/all", token()).then((d) => setMaterials(d.materials || [])).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
  }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setFile(null); setModal(true); };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) { notify.toast("Please choose a file to upload."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("document", file);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      fd.append("subject", form.subject);
      if (form.course_id) fd.append("course_id", form.course_id);
      if (form.program_id) fd.append("program_id", form.program_id);
      await api.postForm("/api/materials/upload", fd, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
    finally { setUploading(false); }
  };

  const toggle = async (m) => {
    try { await api.put(`/api/materials/${m.id}`, { is_active: m.is_active ? 0 : 1 }, token()); load(); }
    catch (e) { notify.error(e.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this material permanently?"))) return;
    try { await api.del(`/api/materials/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const tag = (m) => {
    if (m.course_title) return `Course: ${m.course_title}`;
    if (m.program_title) return `Program: ${m.program_title}`;
    if (m.batch_id) return `Batch #${m.batch_id}`;
    return "General";
  };

  const filtered = useMemo(() => {
    const rows = materials.filter((m) => {
      if (filter.course_id && String(m.course_id) !== filter.course_id) return false;
      if (filter.program_id && String(m.program_id) !== filter.program_id) return false;
      if (filter.q) {
        const hay = [m.title, m.category, m.subject, m.course_title, m.program_title].join(" ").toLowerCase();
        if (!hay.includes(filter.q.toLowerCase())) return false;
      }
      return true;
    });
    const sorted = [...rows].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      return new Date(b.created_at) - new Date(a.created_at); // newest (default)
    });
    return sorted;
  }, [materials, filter, sort]);

  // Any filter/sort change should jump back to page 1 -- otherwise "page 3
  // of 1" after narrowing a filter is confusing (same fix already applied
  // to the Students list).
  useEffect(() => { setPage(1); }, [filter, sort]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader title="Study Materials" subtitle={`${materials.length} total`} action={<Button onClick={openNew}>+ Upload Material</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-3 flex flex-wrap gap-2">
        <input placeholder="Search title / subject…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <select value={filter.course_id} onChange={(e) => setFilter({ ...filter, course_id: e.target.value, program_id: "" })}
          className="rounded-lg border-2 border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select value={filter.program_id} onChange={(e) => setFilter({ ...filter, program_id: e.target.value, course_id: "" })}
          className="rounded-lg border-2 border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none">
          <option value="">All programs</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border-2 border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Tagged to</Th><Th>Subject</Th><Th>File</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {paged.length === 0 ? (
            <tr><Td className="text-gray-500">No study materials.</Td></tr>
          ) : paged.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50">
              <Td className="font-medium">{m.title} {m.video_url && <span className="text-xs text-red-600">▶ video</span>}<div className="text-xs text-gray-400">{m.category}</div></Td>
              <Td className="text-xs">{tag(m)}</Td>
              <Td className="text-xs">{m.subject || "—"}</Td>
              <Td><a href={m.video_url || api.mediaUrl(m.file_path)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a></Td>
              <Td><StatusBadge status={m.is_active ? "active" : "draft"} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => toggle(m)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">{m.is_active ? "Disable" : "Enable"}</button>
                  <button onClick={() => remove(m.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      <Modal open={modal} title="Upload Study Material" onClose={() => setModal(false)}>
        <form onSubmit={upload} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" name="category" value={form.category} onChange={change} placeholder="e.g., Notes" />
            <Input label="Subject" name="subject" value={form.subject} onChange={change} placeholder="e.g., HTML & CSS" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Course (optional)" name="course_id" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value, program_id: "" })}>
              <option value="">— None —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Select label="Program (optional)" name="program_id" value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value, course_id: "" })}>
              <option value="">— None —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <p className="text-xs text-gray-400">Tag to a course or program so enrolled students see it. Leave both blank for a general material.</p>
          <textarea name="description" value={form.description} onChange={change} placeholder="Short description"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={2} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">File * (PDF, Word, or image — max 10 MB)</label>
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white" />
          </div>
          <Button type="submit" loading={uploading} className="w-full">Upload</Button>
        </form>
      </Modal>
    </>
  );
}
