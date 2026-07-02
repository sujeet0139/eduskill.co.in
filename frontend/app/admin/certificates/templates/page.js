"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = {
  name: "", heading: "Certificate of Completion",
  body: "This is to certify that {{name}} has successfully completed {{course}} on {{date}}.",
  logo_url: "", seal_url: "", accent_color: "#1e3a8a",
  sig1_name: "", sig1_title: "", sig1_image: "",
  sig2_name: "", sig2_title: "", sig2_image: "",
  sig3_name: "", sig3_title: "", sig3_image: "",
  apply: "default", course_id: "", program_id: "", is_default: true,
};

export default function CertificateTemplates() {
  const [templates, setTemplates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/certificate-templates", token()).then((d) => setTemplates(d.templates || [])).catch((e) => notify.error(e.message));
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (t) => {
    setForm({
      ...EMPTY, ...t,
      apply: t.is_default ? "default" : t.course_id ? "course" : t.program_id ? "program" : "default",
      course_id: t.course_id || "", program_id: t.program_id || "", is_default: !!t.is_default,
    });
    setEditId(t.id); setModal(true);
  };

  const uploadImage = async (field, file) => {
    if (!file) return;
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.postForm("/api/certificate-templates/upload", fd, token());
      setForm((f) => ({ ...f, [field]: res.url }));
    } catch (e) { notify.error(e.message); }
    finally { setUploading(""); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name) { notify.toast("Give the template a name."); return; }
    setSaving(true);
    const payload = {
      ...form,
      is_default: form.apply === "default" ? 1 : 0,
      course_id: form.apply === "course" ? form.course_id || null : null,
      program_id: form.apply === "program" ? form.program_id || null : null,
    };
    try {
      if (editId) await api.put(`/api/certificate-templates/${editId}`, payload, token());
      else await api.post("/api/certificate-templates", payload, token());
      setModal(false); notify.success("Template saved."); load();
    } catch (err) { notify.error(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!(await notify.confirm("Delete this template? Certificates already issued keep their design."))) return;
    try { await api.del(`/api/certificate-templates/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const appliesTo = (t) => t.is_default ? "Default" : t.course_title ? `Course: ${t.course_title}` : t.program_title ? `Program: ${t.program_title}` : "—";

  const SigRow = ({ n }) => (
    <div className="rounded-lg border border-gray-100 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-500">Signatory {n}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Name" name={`sig${n}_name`} value={form[`sig${n}_name`]} onChange={change} />
        <Input label="Designation" name={`sig${n}_title`} value={form[`sig${n}_title`]} onChange={change} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input type="file" accept="image/*" onChange={(e) => uploadImage(`sig${n}_image`, e.target.files?.[0])}
          className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-1 file:text-white" />
        {uploading === `sig${n}_image` && <span className="text-xs text-gray-500">Uploading…</span>}
        {form[`sig${n}_image`] && <img src={api.mediaUrl(form[`sig${n}_image`])} alt="sig" className="h-8 object-contain" />}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Certificate Templates"
        subtitle={`${templates.length} template(s)`}
        action={
          <div className="flex gap-2">
            <Link href="/admin/certificates"><Button className="bg-gray-600 hover:bg-gray-700">← Certificates</Button></Link>
            <Button onClick={openNew}>+ New Template</Button>
          </div>
        }
      />

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Name</Th><Th>Heading</Th><Th>Applies to</Th><Th>Signatories</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {templates.length === 0 ? (
            <tr><Td className="text-gray-500">No templates yet. The built-in design is used until you add one.</Td></tr>
          ) : templates.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <Td className="font-medium">{t.name} {t.is_default ? <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">default</span> : null}</Td>
              <Td className="text-xs">{t.heading}</Td>
              <Td className="text-xs">{appliesTo(t)}</Td>
              <Td className="text-xs">{[t.sig1_name, t.sig2_name, t.sig3_name].filter(Boolean).length}</Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(t)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(t.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={modal} title={editId ? "Edit Template" : "New Certificate Template"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
          <Input label="Template Name * (internal)" name="name" value={form.name} onChange={change} required placeholder="e.g., Web Dev Completion" />
          <Input label="Heading" name="heading" value={form.heading} onChange={change} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Body text</span>
            <textarea name="body" value={form.body} onChange={change} rows={3}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            <span className="text-xs text-gray-400">Placeholders: {"{{name}} {{course}} {{college}} {{date}} {{score}} {{cert_no}}"}</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Accent colour</span>
              <input type="color" name="accent_color" value={form.accent_color} onChange={change} className="h-10 w-full rounded-lg border-2 border-gray-200" />
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Logo</span>
              <input type="file" accept="image/*" onChange={(e) => uploadImage("logo_url", e.target.files?.[0])}
                className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-1 file:text-white" />
              {form.logo_url && <img src={api.mediaUrl(form.logo_url)} alt="logo" className="mt-1 h-8 object-contain" />}
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 gap-2">
            <SigRow n={1} /><SigRow n={2} /><SigRow n={3} />
          </div>

          {/* Seal */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Seal / Stamp (optional)</span>
            <input type="file" accept="image/*" onChange={(e) => uploadImage("seal_url", e.target.files?.[0])}
              className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-1 file:text-white" />
            {form.seal_url && <img src={api.mediaUrl(form.seal_url)} alt="seal" className="mt-1 h-10 object-contain" />}
          </div>

          {/* Mapping */}
          <Select label="Apply this template to" name="apply" value={form.apply} onChange={change}>
            <option value="default">Default (all certificates)</option>
            <option value="course">A specific course</option>
            <option value="program">A specific program</option>
          </Select>
          {form.apply === "course" && (
            <Select label="Course" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— Select course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          )}
          {form.apply === "program" && (
            <Select label="Program" name="program_id" value={form.program_id} onChange={change}>
              <option value="">— Select program —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          )}

          <Button type="submit" loading={saving} className="w-full">{editId ? "Update Template" : "Create Template"}</Button>
        </form>
      </Modal>
    </>
  );
}
