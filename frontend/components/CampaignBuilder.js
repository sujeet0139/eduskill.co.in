"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { useToast } from "@/components/Toast";

const EMPTY = {
  name: "", slug: "", college_id: "", program_id: "", course_id: "", batch_id: "",
  hero_tag: "", headline: "", subheading: "",
  feedback_enabled: true, counselor_toggle_enabled: true,
  confirmation_template: "Thanks, {name}! You're registered for {course} ({batch}), starting {start_date}. Join the group here: {group_link}",
  group_link: "", starts_at: "", ends_at: "", status: "active",
};

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "content", label: "Landing Content" },
  { id: "feedback", label: "Feedback" },
  { id: "confirmation", label: "Confirmation" },
  { id: "link", label: "Link & QR" },
  { id: "registrations", label: "Registrations" },
  { id: "funnel", label: "Funnel" },
];

export default function CampaignBuilder({ campaignId }) {
  const isNew = !campaignId || campaignId === "new";
  const router = useRouter();
  const token = () => adminAuth.token();
  const notify = useToast();

  const [tab, setTab] = useState("basics");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [benefits, setBenefits] = useState([]);
  const [interests, setInterests] = useState([]);
  const [meta, setMeta] = useState({ colleges: [], programs: [], courses: [], batches: [] });

  useEffect(() => {
    api.get("/api/colleges", token()).then((d) => setMeta((m) => ({ ...m, colleges: d.colleges || [] }))).catch(() => {});
    api.get("/api/programs", token()).then((d) => setMeta((m) => ({ ...m, programs: d.programs || [] }))).catch(() => {});
    api.get("/api/courses", token()).then((d) => setMeta((m) => ({ ...m, courses: d.courses || [] }))).catch(() => {});
    api.get("/api/batches", token()).then((d) => setMeta((m) => ({ ...m, batches: d.batches || [] }))).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    api.get(`/api/campaigns/${campaignId}`, token())
      .then((d) => {
        const c = d.campaign;
        setForm({
          name: c.name, slug: c.slug,
          college_id: c.college_id || "", program_id: c.program_id || "", course_id: c.course_id || "", batch_id: c.batch_id || "",
          hero_tag: c.hero_tag || "", headline: c.headline || "", subheading: c.subheading || "",
          feedback_enabled: !!c.feedback_enabled, counselor_toggle_enabled: !!c.counselor_toggle_enabled,
          confirmation_template: c.confirmation_template || EMPTY.confirmation_template,
          group_link: c.group_link || "",
          starts_at: c.starts_at ? c.starts_at.slice(0, 16) : "", ends_at: c.ends_at ? c.ends_at.slice(0, 16) : "",
          status: c.status,
        });
        setBenefits(c.benefits.map((b) => ({ icon: b.icon || "", title: b.title, description: b.description || "" })));
        setInterests(c.interests.map((i) => i.label));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, benefits, interests };
      if (isNew) {
        const res = await api.post("/api/campaigns", payload, token());
        notify.success("Campaign created.");
        router.push(`/admin/campaigns/${res.id}`);
      } else {
        await api.put(`/api/campaigns/${campaignId}`, payload, token());
        notify.success("Campaign saved.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Benefits (addable/removable/reorderable, not a fixed count) ----
  const addBenefit = () => setBenefits([...benefits, { icon: "🎓", title: "", description: "" }]);
  const changeBenefit = (i, field, value) => setBenefits(benefits.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  const removeBenefit = (i) => setBenefits(benefits.filter((_, idx) => idx !== i));
  const moveBenefit = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= benefits.length) return;
    const next = [...benefits];
    [next[i], next[j]] = [next[j], next[i]];
    setBenefits(next);
  };

  // ---- Interest chips ----
  const [newInterest, setNewInterest] = useState("");
  const addInterest = () => { if (newInterest.trim()) { setInterests([...interests, newInterest.trim()]); setNewInterest(""); } };
  const removeInterest = (i) => setInterests(interests.filter((_, idx) => idx !== i));
  const moveInterest = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= interests.length) return;
    const next = [...interests];
    [next[i], next[j]] = [next[j], next[i]];
    setInterests(next);
  };

  if (loading) return <p className="p-6 text-gray-500">Loading…</p>;

  return (
    <>
      <PageHeader
        title={isNew ? "New Campaign" : form.name}
        subtitle={isNew ? "Set up a shareable registration link for an event/college visit." : `/c/${form.slug}`}
        action={<Button onClick={save} loading={saving}>{isNew ? "Create Campaign" : "Save Changes"}</Button>}
      />
      {error && <div className="mb-3"><Alert type="error">{error}</Alert></div>}

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-6">
          {TABS.map((t) => {
            const disabled = isNew && ["link", "registrations", "funnel"].includes(t.id);
            return (
              <button
                key={t.id}
                disabled={disabled}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium ${
                  disabled ? "cursor-not-allowed border-transparent text-gray-300" :
                  tab === t.id ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "basics" && (
        <div className="max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <Input label="Campaign Name (internal label) *" name="name" value={form.name} onChange={change} required placeholder="e.g. Noida College Visit — Jan 2026" />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Slug (in the URL) *</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              disabled={!isNew}
              placeholder="noida-college-session"
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 font-mono text-sm focus:border-brand focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {isNew ? "Lowercase letters, numbers, hyphens only. Cannot be changed after creation." : "Locked — changing this would break any already-shared/printed link."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="College" name="college_id" value={form.college_id} onChange={change}>
              <option value="">— None —</option>
              {meta.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Program" name="program_id" value={form.program_id} onChange={change}>
              <option value="">— None —</option>
              {meta.programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
            <Select label="Course" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— None —</option>
              {meta.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Select label="Batch" name="batch_id" value={form.batch_id} onChange={change}>
              <option value="">— None —</option>
              {meta.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <p className="text-xs text-gray-500">At least one of College/Program/Course/Batch is required — this is what the student's registration gets pre-filled with.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Opens (optional)</label>
              <input type="datetime-local" name="starts_at" value={form.starts_at} onChange={change}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Closes (optional)</label>
              <input type="datetime-local" name="ends_at" value={form.ends_at} onChange={change}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
          </div>
          <p className="text-xs text-gray-500">After the close date, the link shows "this link has expired" instead of the form.</p>

          <Select label="Status" name="status" value={form.status} onChange={change}>
            <option value="active">Active</option>
            <option value="paused">Paused (link stays but stops accepting registrations)</option>
          </Select>
        </div>
      )}

      {tab === "content" && (
        <div className="max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <Input label="Hero Tag" name="hero_tag" value={form.hero_tag} onChange={change} placeholder="e.g. 🎓 Campus Visit Special" />
          <Input label="Headline" name="headline" value={form.headline} onChange={change} placeholder="e.g. Kickstart your career in AI/ML" />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subheading</label>
            <textarea name="subheading" value={form.subheading} onChange={change} rows={2}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </div>

          <div className="border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-900">Benefit Cards</label>
              <button onClick={addBenefit} className="text-xs font-medium text-brand hover:underline">+ Add card</button>
            </div>
            <div className="space-y-2">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3">
                  <input value={b.icon} onChange={(e) => changeBenefit(i, "icon", e.target.value)} placeholder="🎓"
                    className="w-14 rounded border border-gray-200 px-2 py-1.5 text-center text-lg" />
                  <div className="flex-1 space-y-1">
                    <input value={b.title} onChange={(e) => changeBenefit(i, "title", e.target.value)} placeholder="Title"
                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm font-medium" />
                    <input value={b.description} onChange={(e) => changeBenefit(i, "description", e.target.value)} placeholder="Short description"
                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveBenefit(i, -1)} disabled={i === 0} className="rounded bg-gray-100 px-1.5 text-xs disabled:opacity-30">↑</button>
                    <button onClick={() => moveBenefit(i, 1)} disabled={i === benefits.length - 1} className="rounded bg-gray-100 px-1.5 text-xs disabled:opacity-30">↓</button>
                  </div>
                  <button onClick={() => removeBenefit(i)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">✕</button>
                </div>
              ))}
              {benefits.length === 0 && <p className="text-sm text-gray-400">No benefit cards yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div className="max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.feedback_enabled} onChange={(e) => setForm({ ...form, feedback_enabled: e.target.checked })} />
            <span className="text-sm font-medium text-gray-700">Show the feedback step (Step 3) after registration</span>
          </label>
          {form.feedback_enabled && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.counselor_toggle_enabled} onChange={(e) => setForm({ ...form, counselor_toggle_enabled: e.target.checked })} />
                <span className="text-sm font-medium text-gray-700">Show the "call me back" counselor opt-in toggle</span>
              </label>

              <div className="border-t pt-4">
                <label className="mb-2 block text-sm font-semibold text-gray-900">Interest Chips</label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {interests.map((label, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                      {label}
                      <button onClick={() => moveInterest(i, -1)} disabled={i === 0} className="text-gray-400 disabled:opacity-30">↑</button>
                      <button onClick={() => moveInterest(i, 1)} disabled={i === interests.length - 1} className="text-gray-400 disabled:opacity-30">↓</button>
                      <button onClick={() => removeInterest(i)} className="text-red-500">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newInterest} onChange={(e) => setNewInterest(e.target.value)} placeholder="e.g. AI/ML basics"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterest(); } }}
                    className="flex-1 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
                  <button onClick={addInterest} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200">Add</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "confirmation" && (
        <div className="max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirmation Message</label>
            <textarea name="confirmation_template" value={form.confirmation_template} onChange={change} rows={4}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            <p className="mt-1 text-xs text-gray-500">
              Variables: <code className="rounded bg-gray-100 px-1">{"{name}"}</code> <code className="rounded bg-gray-100 px-1">{"{course}"}</code>{" "}
              <code className="rounded bg-gray-100 px-1">{"{batch}"}</code> <code className="rounded bg-gray-100 px-1">{"{start_date}"}</code>{" "}
              <code className="rounded bg-gray-100 px-1">{"{group_link}"}</code>
            </p>
          </div>
          <Input label="Group Link (WhatsApp/Telegram, etc.)" name="group_link" value={form.group_link} onChange={change} placeholder="https://chat.whatsapp.com/..." />
        </div>
      )}

      {tab === "link" && !isNew && <LinkTab campaignId={campaignId} slug={form.slug} token={token} />}
      {tab === "registrations" && !isNew && <RegistrationsTab campaignId={campaignId} token={token} />}
      {tab === "funnel" && !isNew && <FunnelTab campaignId={campaignId} token={token} />}
    </>
  );
}

function LinkTab({ campaignId, slug, token }) {
  const [shortUrl, setShortUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const notify = useToast();
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${slug}` : `/c/${slug}`;

  useEffect(() => {
    api.get(`/api/campaigns/${campaignId}`, token()).then((d) => setShortUrl(d.campaign.shortUrl)).catch(() => {});
  }, [campaignId]);

  const copy = (text) => { navigator.clipboard?.writeText(text); notify.success("Copied."); };
  const generateShort = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/api/campaigns/${campaignId}/short-link`, {}, token());
      setShortUrl(res.shortUrl);
    } catch (err) { notify.error(err.message); }
    finally { setGenerating(false); }
  };

  return (
    <div className="max-w-2xl space-y-6 rounded-xl bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Full Link</label>
        <div className="flex gap-2">
          <input readOnly value={fullUrl} className="flex-1 rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono" />
          <button onClick={() => copy(fullUrl)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200">Copy</button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Short Link</label>
        {shortUrl ? (
          <div className="flex gap-2">
            <input readOnly value={shortUrl} className="flex-1 rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono" />
            <button onClick={() => copy(shortUrl)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200">Copy</button>
          </div>
        ) : (
          <button onClick={generateShort} disabled={generating} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            {generating ? "Generating…" : "Generate Short Link"}
          </button>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">QR Code</label>
        <img src={`${api.base}/api/campaigns/${campaignId}/qr`} alt="Campaign QR code" className="h-40 w-40 rounded-lg border" />
        <a href={`${api.base}/api/campaigns/${campaignId}/qr`} download className="mt-2 inline-block text-sm text-brand hover:underline">Download PNG</a>
      </div>

      <a href={`/c/${slug}`} target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
        Open Live Preview →
      </a>
    </div>
  );
}

function RegistrationsTab({ campaignId, token }) {
  const [regs, setRegs] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const notify = useToast();

  const load = () => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    api.get(`/api/campaigns/${campaignId}/registrations${params}`, token()).then((d) => setRegs(d.registrations || [])).catch(() => {});
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const markContacted = async () => {
    if (!selected.size) return;
    try {
      await api.post(`/api/campaigns/${campaignId}/registrations/bulk-contacted`, { ids: Array.from(selected) }, token());
      setSelected(new Set());
      load();
    } catch (err) { notify.error(err.message); }
  };
  const exportCsv = () => { window.open(`${api.base}/api/campaigns/${campaignId}/registrations/export`, "_blank"); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input placeholder="Search name / mobile / email…" value={q} onChange={(e) => setQ(e.target.value)}
          className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <div className="flex gap-2">
          <Button onClick={markContacted} disabled={!selected.size} className="bg-gray-600 hover:bg-gray-700">Mark Contacted ({selected.size})</Button>
          <Button onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>
      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th></Th><Th>Name</Th><Th>Mobile</Th><Th>Email</Th><Th>Registered</Th><Th>Rating</Th><Th>Interests</Th><Th>Callback?</Th><Th>Contacted</Th></tr>
        </thead>
        <tbody className="divide-y">
          {regs.length === 0 ? (
            <tr><Td className="text-gray-500">No registrations yet.</Td></tr>
          ) : regs.map((r) => (
            <tr key={r.id} className={r.counselor_opt_in ? "bg-amber-50" : ""}>
              <Td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></Td>
              <Td className="font-medium">{r.name}</Td>
              <Td>{r.phone}</Td>
              <Td>{r.email}</Td>
              <Td className="text-xs">{new Date(r.registered_at).toLocaleString()}</Td>
              <Td>{r.feedback_rating ? "★".repeat(r.feedback_rating) : "—"}</Td>
              <Td className="max-w-[160px] truncate text-xs">{r.selected_interests ? JSON.parse(r.selected_interests).join(", ") : "—"}</Td>
              <Td>{r.counselor_opt_in ? <span className="font-semibold text-amber-700">Yes</span> : "No"}</Td>
              <Td>{r.contacted ? "✓" : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

function FunnelTab({ campaignId, token }) {
  const [funnel, setFunnel] = useState(null);
  useEffect(() => { api.get(`/api/campaigns/${campaignId}/funnel`, token()).then((d) => setFunnel(d.funnel)).catch(() => {}); }, [campaignId]);
  if (!funnel) return <p className="text-gray-500">Loading…</p>;

  const stages = [
    { label: "Link opens", value: funnel.link_opens },
    { label: "Registrations started", value: funnel.registrations_started },
    { label: "Registrations completed", value: funnel.registrations_completed },
    { label: "Feedback submitted", value: funnel.feedback_submitted },
    { label: "Counselor opt-ins", value: funnel.counselor_optins },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="max-w-2xl space-y-3 rounded-xl bg-white p-6 shadow-sm">
      {stages.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex justify-between text-sm"><span className="text-gray-700">{s.label}</span><span className="font-semibold">{s.value}</span></div>
          <div className="h-3 w-full rounded-full bg-gray-100">
            <div className="h-3 rounded-full bg-brand" style={{ width: `${(s.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {funnel.link_opens === 0 && <p className="text-sm text-gray-400">No link opens recorded yet — share the QR/link to start seeing data here.</p>}
    </div>
  );
}
