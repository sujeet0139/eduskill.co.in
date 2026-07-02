"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = {
  name: "",
  college_code: "",
  district_id: "",
  state: "Bihar",
  address: "",
  contact_no: "",
  principal_details: "",
};

export default function AdminColleges() {
  const [colleges, setColleges] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/colleges", token()).then((d) => setColleges(d.colleges || [])).catch((e) => setError(e.message));
    api.get("/api/districts", token()).then((d) => setDistricts(d.districts || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (c) => {
    setForm({ ...EMPTY, ...c, district_id: c.district_id || "" });
    setEditId(c.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/api/colleges/${editId}`, form, token());
      else await api.post("/api/colleges", form, token());
      setModal(false); load();
    } catch (err) { notify.error(err.message); }
  };
  const remove = async (id) => {
    if (!(await notify.confirm("Delete this college? Students linked to it may also be removed."))) return;
    try { await api.del(`/api/colleges/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const filtered = colleges.filter((c) =>
    [c.name, c.college_code, c.district_name].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Colleges" subtitle={`${colleges.length} total`} action={<Button onClick={openNew}>+ New College</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-3">
        <Input placeholder="Search colleges…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>Code</Th><Th>District</Th><Th>Contact</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No colleges found.</Td></tr>
          ) : filtered.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <Td className="font-medium">{c.name}</Td>
              <Td>{c.college_code || "—"}</Td>
              <Td>{c.district_name || "—"}</Td>
              <Td>{c.contact_no || "—"}</Td>
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

      <Modal open={modal} title={editId ? "Edit College" : "New College"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="College Name *" name="name" value={form.name} onChange={change} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="College Code" name="college_code" value={form.college_code} onChange={change} />
            <Select label="District" name="district_id" value={form.district_id} onChange={change}>
              <option value="">— Select district —</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="State" name="state" value={form.state} onChange={change} />
            <Input label="Contact No." name="contact_no" value={form.contact_no} onChange={change} />
          </div>
          <textarea name="address" value={form.address} onChange={change} placeholder="Address"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={2} />
          <textarea name="principal_details" value={form.principal_details} onChange={change} placeholder="Principal details"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={2} />
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
