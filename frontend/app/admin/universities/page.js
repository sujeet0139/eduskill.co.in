"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { ImageUploadField } from "@/components/ImageUploadField";
import { useToast } from "@/components/Toast";

// Section C#3 -- previously name-only with GET/POST only, and no admin
// screen at all (colleges only ever read the list for a dropdown).
const EMPTY = { name: "", short_code: "", state: "", website: "", logo_url: "" };

export default function AdminUniversities() {
  const [universities, setUniversities] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => api.get("/api/universities", token()).then((d) => setUniversities(d.universities || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (u) => {
    setForm({ name: u.name, short_code: u.short_code || "", state: u.state || "", website: u.website || "", logo_url: u.logo_url || "" });
    setEditId(u.id);
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/api/universities/${editId}`, form, token());
      else await api.post("/api/universities", form, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this university? Colleges affiliated with it will keep their record, just lose this link."))) return;
    try { await api.del(`/api/universities/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const filtered = universities.filter((u) =>
    [u.name, u.short_code, u.state].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Universities" subtitle={`${universities.length} total`} action={<Button onClick={openNew}>+ New University</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Input placeholder="Search universities…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Logo</Th><Th>Name</Th><Th>Code</Th><Th>State</Th><Th>Website</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No universities found.</Td></tr>
          ) : filtered.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <Td>{u.logo_url ? <img src={api.mediaUrl(u.logo_url)} alt="" className="h-8 w-8 rounded object-contain" /> : "—"}</Td>
              <Td className="font-medium">{u.name}</Td>
              <Td>{u.short_code || "—"}</Td>
              <Td>{u.state || "—"}</Td>
              <Td>{u.website ? <a href={u.website} target="_blank" rel="noreferrer" className="text-brand hover:underline">Visit</a> : "—"}</Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(u)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(u.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit University" : "New University"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Name *" name="name" value={form.name} onChange={change} required />
          <Input label="Short Code" name="short_code" value={form.short_code} onChange={change} placeholder="e.g., LNMU" />
          <Input label="State" name="state" value={form.state} onChange={change} placeholder="e.g., Bihar" />
          <Input label="Website" name="website" value={form.website} onChange={change} placeholder="https://…" />
          <ImageUploadField
            label="Logo" fieldName="logo" previewUrl={form.logo_url}
            uploadUrl="/api/colleges/upload-logo" token={token()}
            onUploaded={(url) => setForm((f) => ({ ...f, logo_url: url }))}
            hint="Reuses the same upload endpoint as College logos."
          />
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
