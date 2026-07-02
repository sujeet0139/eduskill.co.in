"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { name: "", email: "", password: "", role: "moderator", is_active: 1 };

export default function AdminUsers() {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => api.get("/api/admins", token()).then((d) => setAdmins(d.admins || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (a) => { setForm({ name: a.name, email: a.email, password: "", role: a.role, is_active: a.is_active ? 1 : 0 }); setEditId(a.id); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/api/admins/${editId}`, { name: form.name, email: form.email, role: form.role, is_active: Number(form.is_active) ? 1 : 0 }, token());
      } else {
        if (!form.password) { notify.error("Password is required for a new admin."); setSaving(false); return; }
        await api.post("/api/admins", { name: form.name, email: form.email, password: form.password, role: form.role }, token());
      }
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Admin Users" subtitle={`${admins.length} total`} action={<Button onClick={openNew}>+ New Admin</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {admins.length === 0 ? (
            <tr><Td className="text-gray-500">No admin users.</Td></tr>
          ) : admins.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <Td className="font-medium">{a.name}</Td>
              <Td>{a.email}</Td>
              <Td><span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs capitalize text-gray-700">{a.role}</span></Td>
              <Td><StatusBadge status={a.is_active ? "active" : "revoked"} /></Td>
              <Td>
                <button onClick={() => openEdit(a)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Admin" : "New Admin"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Name *" name="name" value={form.name} onChange={change} required />
          <Input label="Email *" type="email" name="email" value={form.email} onChange={change} required />
          {!editId && <Input label="Password *" type="password" name="password" value={form.password} onChange={change} required minLength={6} />}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role" name="role" value={form.role} onChange={change}>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </Select>
            {editId && (
              <Select label="Status" name="is_active" value={form.is_active} onChange={change}>
                <option value={1}>Active</option>
                <option value={0}>Deactivated</option>
              </Select>
            )}
          </div>
          <Button type="submit" loading={saving} className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
