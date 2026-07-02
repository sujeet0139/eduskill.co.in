"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { name: "", college_id: "", semester_count: 6, is_active: 1 };

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/departments", token()).then((d) => setDepartments(d.departments || [])).catch((e) => setError(e.message));
    api.get("/api/colleges", token()).then((d) => setColleges(d.colleges || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (d) => {
    setForm({ name: d.name, college_id: d.college_id, semester_count: d.semester_count, is_active: d.is_active ? 1 : 0 });
    setEditId(d.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, is_active: Number(form.is_active) ? 1 : 0 };
      if (editId) await api.put(`/api/departments/${editId}`, payload, token());
      else await api.post("/api/departments", payload, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this department?"))) return;
    try { await api.del(`/api/departments/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Departments" subtitle={`${departments.length} total`} action={<Button onClick={openNew}>+ New Department</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>College</Th><Th>Semesters</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {departments.length === 0 ? (
            <tr><Td className="text-gray-500">No departments yet.</Td></tr>
          ) : departments.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50">
              <Td className="font-medium">{d.name}</Td>
              <Td>{d.college_name || "—"}</Td>
              <Td>{d.semester_count}</Td>
              <Td><StatusBadge status={d.is_active ? "active" : "inactive"} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(d)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(d.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Department" : "New Department"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Department Name *" name="name" value={form.name} onChange={change} required />
          <Select label="College *" name="college_id" value={form.college_id} onChange={change} required>
            <option value="">— Select college —</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Semester Count" type="number" name="semester_count" value={form.semester_count} onChange={change} />
            <Select label="Status" name="is_active" value={form.is_active} onChange={change}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </Select>
          </div>
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
