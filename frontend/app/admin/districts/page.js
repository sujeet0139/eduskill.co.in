"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = { name: "", code: "", state: "Bihar" };

export default function AdminDistricts() {
  const [districts, setDistricts] = useState([]);
  const [states, setStates] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => api.get("/api/districts", token()).then((d) => setDistricts(d.districts || [])).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // Full India state list (master-dev-prompt Section C#1) -- previously
    // this dropdown didn't exist at all and every city/district silently
    // defaulted to Bihar, so the seeded state list had nowhere to be used.
    api.get("/api/districts/states", token()).then((d) => setStates(d.states || [])).catch(() => {});
  }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (d) => { setForm({ ...EMPTY, name: d.name, code: d.code, state: d.state || "Bihar" }); setEditId(d.id); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/api/districts/${editId}`, form, token());
      else await api.post("/api/districts", form, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this city/district?"))) return;
    try { await api.del(`/api/districts/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Cities / Districts" subtitle={`${districts.length} total`} action={<Button onClick={openNew}>+ New City</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>State</Th><Th>Code</Th><Th>Colleges</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {districts.length === 0 ? (
            <tr><Td className="text-gray-500">No cities yet.</Td></tr>
          ) : districts.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50">
              <Td className="font-medium">{d.name}</Td>
              <Td>{d.state}</Td>
              <Td>{d.code}</Td>
              <Td>{d.total_colleges ?? 0}</Td>
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

      <Modal open={modal} title={editId ? "Edit City" : "New City"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="City / District Name *" name="name" value={form.name} onChange={change} required />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">State *</span>
            <select
              name="state" value={form.state} onChange={change} required
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              {states.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
          <Input label="Code *" name="code" value={form.code} onChange={change} required placeholder="e.g., DBG" />
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
