"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { title: "", subtitle: "", alt_text: "", cta_text: "", cta_link: "", order_no: 0, is_active: true };

export default function AdminHeroSlides() {
  const [slides, setSlides] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => api.get("/api/hero-slides", token()).then((d) => setSlides(d.slides || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setFile(null); setEditId(null); setModal(true); };
  const openEdit = (s) => { setForm({ ...EMPTY, ...s, is_active: !!s.is_active }); setFile(null); setEditId(s.id); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!editId && !file) { notify.toast("Please choose an image for the new slide."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      if (file) fd.append("image", file);
      fd.append("title", form.title || "");
      fd.append("subtitle", form.subtitle || "");
      fd.append("alt_text", form.alt_text || "");
      fd.append("cta_text", form.cta_text || "");
      fd.append("cta_link", form.cta_link || "");
      fd.append("order_no", form.order_no || 0);
      fd.append("is_active", form.is_active ? "true" : "false");
      if (editId) await api.putForm(`/api/hero-slides/${editId}`, fd, token());
      else await api.postForm("/api/hero-slides", fd, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!(await notify.confirm("Delete this slide?"))) return;
    try { await api.del(`/api/hero-slides/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Hero Slides" subtitle="Homepage carousel — controls eduskill.co.in banner" action={<Button onClick={openNew}>+ New Slide</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Image</Th><Th>Title</Th><Th>Order</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {slides.length === 0 ? (
            <tr><Td className="text-gray-500">No slides yet.</Td></tr>
          ) : slides.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <Td>{s.image_url ? <img src={api.mediaUrl(s.image_url)} alt={s.alt_text || ""} className="h-10 w-20 rounded object-cover" /> : "—"}</Td>
              <Td className="font-medium">{s.title || <span className="text-gray-400">(no title)</span>}</Td>
              <Td>{s.order_no}</Td>
              <Td><StatusBadge status={s.is_active ? "active" : "draft"} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(s.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Slide" : "New Slide"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title" name="title" value={form.title} onChange={change} />
          <Input label="Subtitle" name="subtitle" value={form.subtitle} onChange={change} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Button Text" name="cta_text" value={form.cta_text} onChange={change} placeholder="Apply Now" />
            <Input label="Button Link" name="cta_link" value={form.cta_link} onChange={change} placeholder="/register" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Order" type="number" name="order_no" value={form.order_no} onChange={change} />
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span className="text-sm">Active (shown on site)</span>
            </label>
          </div>
          <Input label="Alt text (accessibility)" name="alt_text" value={form.alt_text} onChange={change} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Image {editId ? "(leave empty to keep current)" : "*"} — JPG/PNG/WebP, max 2 MB
            </label>
            <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-white" />
          </div>
          <Button type="submit" loading={saving} className="w-full">{editId ? "Update Slide" : "Create Slide"}</Button>
        </form>
      </Modal>
    </>
  );
}
