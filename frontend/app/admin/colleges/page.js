"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { StateDistrictSelect } from "@/components/StateDistrictSelect";
import { useToast } from "@/components/Toast";

const EMPTY = {
  name: "",
  college_code: "",
  district_id: "",
  state: "Bihar",
  address: "",
  contact_no: "",
  principal_details: "",
  university_id: "",
  website: "",
  logo_url: "",
  principal_name: "",
  principal_phone: "",
};

export default function AdminColleges() {
  const [colleges, setColleges] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // HOD management for the college currently being edited
  const [hods, setHods] = useState([]);
  const [newHod, setNewHod] = useState({ name: "", department: "", phone: "", email: "" });

  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/colleges", token()).then((d) => setColleges(d.colleges || [])).catch((e) => setError(e.message));
    api.get("/api/universities", token()).then((d) => setUniversities(d.universities || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setHods([]); setModal(true); };
  const openEdit = async (c) => {
    setForm({ ...EMPTY, ...c, district_id: c.district_id || "", university_id: c.university_id || "" });
    setEditId(c.id);
    setModal(true);
    try {
      const res = await api.get(`/api/colleges/${c.id}`, token());
      setHods(res.college.hods || []);
    } catch { setHods([]); }
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

  const uploadLogo = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await api.postForm("/api/colleges/upload-logo", fd, token());
      setForm((f) => ({ ...f, logo_url: res.url }));
    } catch (err) { notify.error(err.message); }
    finally { setLogoUploading(false); }
  };

  const addHod = async () => {
    if (!editId || !newHod.name) return;
    try {
      await api.post(`/api/colleges/${editId}/hods`, newHod, token());
      const res = await api.get(`/api/colleges/${editId}`, token());
      setHods(res.college.hods || []);
      setNewHod({ name: "", department: "", phone: "", email: "" });
    } catch (err) { notify.error(err.message); }
  };
  const removeHod = async (hodId) => {
    try {
      await api.del(`/api/colleges/${editId}/hods/${hodId}`, token());
      setHods((h) => h.filter((x) => x.id !== hodId));
    } catch (err) { notify.error(err.message); }
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
          <tr><Th>Logo</Th><Th>Name</Th><Th>Code</Th><Th>District</Th><Th>University</Th><Th>Contact</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No colleges found.</Td></tr>
          ) : filtered.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <Td>{c.logo_url ? <img src={api.mediaUrl(c.logo_url)} alt="" className="h-8 w-8 rounded object-contain" /> : "—"}</Td>
              <Td className="font-medium">{c.name}</Td>
              <Td>{c.college_code || "—"}</Td>
              <Td>{c.district_name || "—"}</Td>
              <Td>{c.university_name || "—"}</Td>
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
        <form onSubmit={save} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <Input label="College Name *" name="name" value={form.name} onChange={change} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="College Code / ID *" name="college_code" value={form.college_code} onChange={change} required />
            <Select label="Affiliated University" name="university_id" value={form.university_id} onChange={change}>
              <option value="">— Select university —</option>
              {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>

          <StateDistrictSelect
            state={form.state}
            districtId={form.district_id}
            onStateChange={(v) => setForm((f) => ({ ...f, state: v }))}
            onDistrictChange={(v) => setForm((f) => ({ ...f, district_id: v }))}
            token={token()}
          />

          <textarea name="address" value={form.address} onChange={change} placeholder="Full Address"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={2} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact No." name="contact_no" value={form.contact_no} onChange={change} />
            <Input label="College Website" name="website" value={form.website} onChange={change} placeholder="https://…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Principal Name" name="principal_name" value={form.principal_name} onChange={change} />
            <Input label="Principal Contact" name="principal_phone" value={form.principal_phone} onChange={change} />
          </div>
          <textarea name="principal_details" value={form.principal_details} onChange={change} placeholder="Additional principal / admin notes (optional)"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" rows={2} />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">College Logo</label>
            <input type="file" accept="image/*" disabled={logoUploading} onChange={(e) => uploadLogo(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" />
            {logoUploading && <p className="mt-1 text-xs text-gray-500">Uploading…</p>}
            {form.logo_url && <img src={api.mediaUrl(form.logo_url)} alt="Logo" className="mt-2 h-16 w-16 rounded border object-contain p-1" />}
          </div>

          {/* HOD Details -- "support multiple" (item #23). Only usable once the
              college exists, since HODs are stored against a college_id. */}
          <div className="border-t pt-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">HOD Details</label>
            {!editId ? (
              <p className="text-xs text-gray-500">Save the college first, then add HODs from Edit.</p>
            ) : (
              <>
                {hods.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {hods.map((h) => (
                      <div key={h.id} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-sm">
                        <span>{h.name} {h.department && `— ${h.department}`} {h.phone && `(${h.phone})`}</span>
                        <button type="button" onClick={() => removeHod(h.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Name" value={newHod.name} onChange={(e) => setNewHod({ ...newHod, name: e.target.value })}
                    className="rounded-lg border-2 border-gray-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" />
                  <input placeholder="Department" value={newHod.department} onChange={(e) => setNewHod({ ...newHod, department: e.target.value })}
                    className="rounded-lg border-2 border-gray-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" />
                  <input placeholder="Phone" value={newHod.phone} onChange={(e) => setNewHod({ ...newHod, phone: e.target.value })}
                    className="rounded-lg border-2 border-gray-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" />
                  <input placeholder="Email" value={newHod.email} onChange={(e) => setNewHod({ ...newHod, email: e.target.value })}
                    className="rounded-lg border-2 border-gray-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" />
                </div>
                <button type="button" onClick={addHod} className="mt-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200">+ Add HOD</button>
              </>
            )}
          </div>

          <Button type="submit" className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>
    </>
  );
}
