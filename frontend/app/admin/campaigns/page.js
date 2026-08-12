"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState("");
  const [cloning, setCloning] = useState(null); // campaign being cloned
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneBusy, setCloneBusy] = useState(false);
  const [compareIds, setCompareIds] = useState([]);

  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    api.get("/api/campaigns", token()).then((d) => setCampaigns(d.campaigns || [])).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const remove = async (id) => {
    if (!(await notify.confirm("Delete this campaign? Its registrations stay on the students, but campaign stats/config are lost."))) return;
    try { await api.del(`/api/campaigns/${id}`, token()); load(); } catch (e) { notify.error(e.message); }
  };

  const openClone = (c) => { setCloning(c); setCloneSlug(`${c.slug}-2`); setCloneName(`${c.name} (copy)`); };
  const submitClone = async () => {
    setCloneBusy(true);
    try {
      const res = await api.post(`/api/campaigns/${cloning.id}/clone`, { slug: cloneSlug, name: cloneName }, token());
      setCloning(null);
      load();
      notify.success(`Cloned as "${cloneName}".`);
      window.location.href = `/admin/campaigns/${res.id}`;
    } catch (err) { notify.error(err.message); }
    finally { setCloneBusy(false); }
  };

  const toggleCompare = (id) => setCompareIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <>
      <PageHeader
        title="Campaign Links"
        subtitle={`${campaigns.length} total`}
        action={
          <div className="flex gap-2">
            {compareIds.length >= 2 && (
              <Link href={`/admin/campaigns/compare?ids=${compareIds.join(",")}`}>
                <Button className="bg-gray-600 hover:bg-gray-700">Compare ({compareIds.length})</Button>
              </Link>
            )}
            <Link href="/admin/campaigns/new"><Button>+ New Campaign</Button></Link>
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th></Th><Th>Name</Th><Th>Link</Th><Th>Target</Th><Th>Status</Th><Th>Registrations</Th><Th>Views</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {campaigns.length === 0 ? (
            <tr><Td className="text-gray-500">No campaigns yet.</Td></tr>
          ) : campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <Td><input type="checkbox" checked={compareIds.includes(c.id)} onChange={() => toggleCompare(c.id)} /></Td>
              <Td className="font-medium">
                <Link href={`/admin/campaigns/${c.id}`} className="text-brand hover:underline">{c.name}</Link>
              </Td>
              <Td className="font-mono text-xs">/c/{c.slug}</Td>
              <Td className="max-w-[180px] truncate text-xs text-gray-500">
                {c.course_title || c.program_title || c.college_name || "—"}{c.batch_name ? ` — ${c.batch_name}` : ""}
              </Td>
              <Td><StatusBadge status={c.status === "active" ? "active" : "revoked"} /></Td>
              <Td>{c.registration_count || 0}</Td>
              <Td>{c.view_count || 0}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={`/admin/campaigns/${c.id}`} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Edit</Link>
                  <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200">Preview</a>
                  <button onClick={() => openClone(c)} className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 hover:bg-purple-200">Clone</button>
                  <button onClick={() => remove(c.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal open={!!cloning} title="Clone Campaign" onClose={() => setCloning(null)}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Copies benefits, feedback questions, and message template. Swap the target/dates after.</p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">New Name</span>
            <input value={cloneName} onChange={(e) => setCloneName(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">New Slug (in the URL)</span>
            <input value={cloneSlug} onChange={(e) => setCloneSlug(e.target.value.toLowerCase())} placeholder="e.g. patna-college-session"
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm font-mono focus:border-brand focus:outline-none" />
          </label>
          <Button onClick={submitClone} loading={cloneBusy} className="w-full">Clone</Button>
        </div>
      </Modal>
    </>
  );
}
