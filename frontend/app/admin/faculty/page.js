"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";

const EMPTY = { name: "", email: "", phone: "", expertise: "", college_id: "", hourly_rate: "" };

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const token = () => adminAuth.token();

  const load = () => {
    api.get("/api/faculty", token()).then((d) => setFaculty(d.faculty || [])).catch((e) => setError(e.message));
    api.get("/api/colleges", token()).then((d) => setColleges(d.colleges || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (f) => {
    setForm({ ...EMPTY, ...f, college_id: f.college_id || "", hourly_rate: f.hourly_rate ?? "" });
    setEditId(f.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/api/faculty/${editId}`, form, token());
      else await api.post("/api/faculty", form, token());
      setModal(false); load();
    } catch (err) { alert(err.message); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this faculty member?")) return;
    try { await api.del(`/api/faculty/${id}`, token()); load(); } catch (e) { alert(e.message); }
  };

  const filtered = faculty.filter((f) =>
    [f.name, f.email, f.expertise, f.college_name].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Faculty / Mentors" subtitle={`${faculty.length} total`} action={<Button onClick={openNew}>+ New Faculty</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-3">
        <Input placeholder="Search faculty…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>Expertise</Th><Th>Contact</Th><Th>College</Th><Th>Rate/hr</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No faculty found.</Td></tr>
          ) : filtered.map((f) => (
            <tr key={f.id} className="hover:bg-gray-50">
              <Td className="font-medium">{f.name}</Td>
              <Td>{f.expertise || "—"}</Td>
              <Td>{f.phone || f.email || "—"}</Td>
              <Td>{f.college_name || "—"}</Td>
              <Td>{f.hourly_rate ? `₹${f.hourly_rate}` : "—"}</Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(f)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(f.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Faculty" : "New Faculty"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Full Name *" name="name" value={form.name} onChange={change} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" name="email" value={form.email} onChange={change} />
            <Input label="Phone" name="phone" value={form.phone} onChange={change} />
          </div>
          <Input label="Expertise / Subject" name="expertise" value={form.expertise} onChange={change} placeholder="e.g., Web Development" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="College" name="college_id" value={form.college_id} onChange={change}>
              <option value="">— None —</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Hourly Rate (₹)" type="number" name="hourly_rate" value={form.hourly_rate} onChange={change} />
          </div>
          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
