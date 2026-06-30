"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";

export default function AdminMaterials() {
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "" });
  const [file, setFile] = useState(null);
  const token = () => adminAuth.token();

  const load = () =>
    api.get("/api/materials/all", token()).then((d) => setMaterials(d.materials || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm({ title: "", description: "", category: "" }); setFile(null); setModal(true); };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) { alert("Please choose a file to upload."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("document", file);
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      await api.postForm("/api/materials/upload", fd, token());
      setModal(false); load();
    } catch (err) { alert(err.message); }
    finally { setUploading(false); }
  };

  const toggle = async (m) => {
    try { await api.put(`/api/materials/${m.id}`, { is_active: m.is_active ? 0 : 1 }, token()); load(); }
    catch (e) { alert(e.message); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this material permanently?")) return;
    try { await api.del(`/api/materials/${id}`, token()); load(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Study Materials" subtitle={`${materials.length} total`} action={<Button onClick={openNew}>+ Upload Material</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Category</Th><Th>File</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {materials.length === 0 ? (
            <tr><Td className="text-gray-500">No study materials yet.</Td></tr>
          ) : materials.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50">
              <Td className="font-medium">{m.title}</Td>
              <Td>{m.category || "—"}</Td>
              <Td>
                <a href={m.file_path} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
              </Td>
              <Td><StatusBadge status={m.is_active ? "active" : "draft"} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => toggle(m)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">
                    {m.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => remove(m.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title="Upload Study Material" onClose={() => setModal(false)}>
        <form onSubmit={upload} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <Input label="Category" name="category" value={form.category} onChange={change} placeholder="e.g., Web Development" />
          <textarea name="description" value={form.description} onChange={change} placeholder="Short description"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={3} />
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
