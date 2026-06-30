"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";

const EMPTY = { title: "", message: "", target_type: "all", send_email: false, scheduled_at: "" };

export default function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const token = () => adminAuth.token();

  const load = () => api.get("/api/announcements", token()).then((d) => setItems(d.announcements || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/announcements", { ...form, send_email: !!form.send_email, scheduled_at: form.scheduled_at || null }, token());
      setModal(false); load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const resend = async (id) => {
    if (!confirm("Resend this announcement now?")) return;
    try { await api.post(`/api/announcements/${id}/resend`, {}, token()); load(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Announcements" subtitle={`${items.length} total`} action={<Button onClick={openNew}>+ New Announcement</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Audience</Th><Th>Email</Th><Th>Status</Th><Th>Date</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {items.length === 0 ? (
            <tr><Td className="text-gray-500">No announcements yet.</Td></tr>
          ) : items.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <Td className="font-medium">{a.title}<div className="max-w-xs truncate text-xs text-gray-400">{a.message}</div></Td>
              <Td>{a.target_type}</Td>
              <Td>{a.send_email ? "Yes" : "No"}</Td>
              <Td><StatusBadge status={a.status === "sent" ? "active" : "pending"} /></Td>
              <Td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</Td>
              <Td>
                <button onClick={() => resend(a.id)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Resend</button>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title="New Announcement" onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Message *</label>
            <textarea name="message" value={form.message} onChange={change} required rows={4}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Audience" name="target_type" value={form.target_type} onChange={change}>
              <option value="all">All Students</option>
              <option value="verified">Verified Students</option>
              <option value="college">By College</option>
            </Select>
            <Input label="Schedule (optional)" type="datetime-local" name="scheduled_at" value={form.scheduled_at} onChange={change} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.send_email} onChange={(e) => setForm({ ...form, send_email: e.target.checked })} />
            <span className="text-sm">Also send by email</span>
          </label>
          <Button type="submit" loading={saving} className="w-full">Publish</Button>
        </form>
      </Modal>
    </>
  );
}
