"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { title: "", category: "", subject: "", description: "", content_pdf: "", duration_weeks: "", price: "", min_payment: "", language: "English", level: "Beginner", status: "draft" };

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const [pdfUploading, setPdfUploading] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (c) => { setForm({ ...EMPTY, ...c }); setEditId(c.id); setModal(true); };

  const uploadPdf = async (e) => {
    const fileObj = e.target.files?.[0];
    if (!fileObj) return;
    setPdfUploading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", fileObj);
      const res = await api.postForm("/api/courses/upload-content", fd, token());
      setForm((f) => ({ ...f, content_pdf: res.url }));
    } catch (err) { notify.error(err.message); }
    finally { setPdfUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/api/courses/${editId}`, form, token());
      else await api.post("/api/courses", form, token());
      setModal(false);
      load();
    } catch (err) { notify.error(err.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this course?"))) return;
    try { await api.del(`/api/courses/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Courses" subtitle={`${courses.length} total`} action={<Button onClick={openNew}>+ New Course</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Category</Th><Th>Duration</Th><Th>Price</Th><Th>Level</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {courses.length === 0 ? (
            <tr><Td className="text-gray-500">No courses yet.</Td></tr>
          ) : courses.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <Td className="font-medium">{c.title}</Td>
              <Td>{c.category}</Td>
              <Td>{c.duration_weeks ? `${c.duration_weeks}w` : "—"}</Td>
              <Td>{c.price ? `₹${c.price}` : "Free"}</Td>
              <Td>{c.level}</Td>
              <Td><StatusBadge status={c.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(c.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Course" : "New Course"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" name="category" value={form.category} onChange={change} />
            <Input label="Subject" name="subject" value={form.subject} onChange={change} placeholder="e.g., HTML & CSS" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duration (weeks)" type="number" name="duration_weeks" value={form.duration_weeks} onChange={change} />
            <Input label="Language" name="language" value={form.language} onChange={change} />
          </div>
          <textarea name="description" value={form.description} onChange={change} placeholder="Description"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={3} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Content / Syllabus PDF</label>
            <Input name="content_pdf" value={form.content_pdf} onChange={change} placeholder="PDF URL (or upload below)" />
            <div className="mt-2 flex items-center gap-3">
              <input type="file" accept=".pdf" onChange={uploadPdf}
                className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white" />
              {pdfUploading && <span className="text-xs text-gray-500">Uploading…</span>}
              {form.content_pdf && !pdfUploading && <a href={form.content_pdf} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">View PDF</a>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price (₹)" type="number" name="price" value={form.price} onChange={change} />
            <Input label="Min. First Payment (₹)" type="number" name="min_payment" value={form.min_payment} onChange={change} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Level" name="level" value={form.level} onChange={change}>
              {["Beginner", "Intermediate", "Advanced"].map((l) => <option key={l}>{l}</option>)}
            </Select>
            <Select label="Status" name="status" value={form.status} onChange={change}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </Select>
          </div>
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
