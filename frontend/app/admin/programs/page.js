"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { title: "", description: "", duration_weeks: "", fee: "", start_date: "", end_date: "", max_enrollment: "", status: "draft" };

export default function AdminPrograms() {
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (p) => {
    setForm({ ...EMPTY, ...p, start_date: (p.start_date || "").slice(0, 10), end_date: (p.end_date || "").slice(0, 10) });
    setEditId(p.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/api/programs/${editId}`, form, token());
      else await api.post("/api/programs", form, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this program?"))) return;
    try { await api.del(`/api/programs/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Programs" subtitle={`${programs.length} total`} action={<Button onClick={openNew}>+ New Program</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Fee</Th><Th>Duration</Th><Th>Seats</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {programs.length === 0 ? (
            <tr><Td className="text-gray-500">No programs yet.</Td></tr>
          ) : programs.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <Td className="font-medium">{p.title}</Td>
              <Td>{p.fee ? `₹${p.fee}` : "Free"}</Td>
              <Td>{p.duration_weeks ? `${p.duration_weeks}w` : "—"}</Td>
              <Td>{p.max_enrollment || "—"}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(p.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Program" : "New Program"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <textarea name="description" value={form.description} onChange={change} placeholder="Description"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fee (₹)" type="number" name="fee" value={form.fee} onChange={change} />
            <Input label="Duration (weeks)" type="number" name="duration_weeks" value={form.duration_weeks} onChange={change} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" name="start_date" value={form.start_date} onChange={change} />
            <Input label="End Date" type="date" name="end_date" value={form.end_date} onChange={change} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Enrolment" type="number" name="max_enrollment" value={form.max_enrollment} onChange={change} />
            <Select label="Status" name="status" value={form.status} onChange={change}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
