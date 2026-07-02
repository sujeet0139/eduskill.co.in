"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, Alert } from "@/components/ui";
import { PageHeader } from "@/components/admin";
import { useToast } from "@/components/Toast";

// Quick-fill message templates. {{name}} / {{ref}} are personalized per student.
const TEMPLATES = {
  custom: { subject: "", body: "" },
  payment: {
    subject: "Payment reminder — EduSkill",
    body: "Hi {{name}},\n\nThis is a friendly reminder to complete your pending course payment. Your reference number is {{ref}}.\n\nRegards,\nEduSkill Team",
  },
  class: {
    subject: "Live class today — EduSkill",
    body: "Hi {{name}},\n\nYou have a live class scheduled today. Please join on time using the link shared in your dashboard.\n\nSee you there!\nEduSkill Team",
  },
  welcome: {
    subject: "Welcome to EduSkill!",
    body: "Hi {{name}},\n\nWelcome aboard! We're excited to have you. Log in to your dashboard to explore your courses.\n\nEduSkill Team",
  },
};

function waLink(phone, msg) {
  const num = String(phone || "").replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  return num ? `https://wa.me/91${num}?text=${encodeURIComponent(msg)}` : null;
}
function fill(text, r) {
  return String(text || "")
    .replace(/\{\{\s*name\s*\}\}/gi, r.name || "")
    .replace(/\{\{\s*ref\s*\}\}/gi, r.reference_no || "");
}

export default function AdminCommunications() {
  const [channel, setChannel] = useState("email"); // email | whatsapp
  const [audience, setAudience] = useState("all"); // all | college | status | course | program
  const [colleges, setColleges] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [filterId, setFilterId] = useState("");
  const [statusVal, setStatusVal] = useState("verified");

  const [recipients, setRecipients] = useState([]);
  const [loadingR, setLoadingR] = useState(false);

  const [tpl, setTpl] = useState("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const token = () => adminAuth.token();
  const notify = useToast();

  useEffect(() => {
    api.get("/api/colleges", token()).then((d) => setColleges(d.colleges || [])).catch(() => {});
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
    loadHistory();
  }, []);

  const loadHistory = () => api.get("/api/communications/history", token()).then((d) => setHistory(d.logs || [])).catch(() => {});

  // Build the query string for the current audience selection.
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (audience === "college" && filterId) p.set("college_id", filterId);
    if (audience === "status") p.set("status", statusVal);
    if (audience === "course" && filterId) p.set("course_id", filterId);
    if (audience === "program" && filterId) p.set("program_id", filterId);
    return p.toString();
  }, [audience, filterId, statusVal]);

  // Refetch the recipient preview whenever the audience changes.
  useEffect(() => {
    setLoadingR(true);
    api.get(`/api/communications/recipients?${queryParams}`, token())
      .then((d) => setRecipients(d.recipients || []))
      .catch(() => setRecipients([]))
      .finally(() => setLoadingR(false));
  }, [queryParams]);

  const applyTemplate = (key) => {
    setTpl(key);
    setSubject(TEMPLATES[key].subject);
    setBody(TEMPLATES[key].body);
  };

  const audiencePayload = () => {
    const p = {};
    if (audience === "college" && filterId) p.college_id = filterId;
    if (audience === "status") p.status = statusVal;
    if (audience === "course" && filterId) p.course_id = filterId;
    if (audience === "program" && filterId) p.program_id = filterId;
    return p;
  };

  const sendEmail = async () => {
    if (!subject || !body) { notify.toast("Add a subject and message."); return; }
    if (!(await notify.confirm(`Send this email to ${recipients.length} students?`))) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.post("/api/communications/email", { subject, message: body, ...audiencePayload() }, token());
      setResult({ ok: true, msg: res.message });
      loadHistory();
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSending(false);
    }
  };

  const logWhatsApp = () => {
    api.post("/api/communications/log-whatsapp", { subject: subject || "WhatsApp broadcast", recipient_count: withPhone.length }, token())
      .then(loadHistory).catch(() => {});
  };

  const withPhone = recipients.filter((r) => r.phone);

  return (
    <>
      <PageHeader title="Communications" subtitle="Email & WhatsApp broadcasts to your students" />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT: audience + channel */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">1. Channel</h3>
            <div className="flex gap-2">
              {["email", "whatsapp"].map((c) => (
                <button key={c} onClick={() => { setChannel(c); setResult(null); }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${channel === c ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">2. Audience</h3>
            <Select value={audience} onChange={(e) => { setAudience(e.target.value); setFilterId(""); }}>
              <option value="all">All students</option>
              <option value="status">By status</option>
              <option value="college">By college</option>
              <option value="course">By course</option>
              <option value="program">By program</option>
            </Select>

            {audience === "status" && (
              <div className="mt-3">
                <Select value={statusVal} onChange={(e) => setStatusVal(e.target.value)}>
                  <option value="registered">Registered</option>
                  <option value="verified">Verified</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>
            )}
            {audience === "college" && (
              <div className="mt-3">
                <Select value={filterId} onChange={(e) => setFilterId(e.target.value)}>
                  <option value="">— Select college —</option>
                  {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            )}
            {audience === "course" && (
              <div className="mt-3">
                <Select value={filterId} onChange={(e) => setFilterId(e.target.value)}>
                  <option value="">— Select course —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
              </div>
            )}
            {audience === "program" && (
              <div className="mt-3">
                <Select value={filterId} onChange={(e) => setFilterId(e.target.value)}>
                  <option value="">— Select program —</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </Select>
              </div>
            )}

            <p className="mt-3 text-sm text-gray-500">
              {loadingR ? "Counting…" : (
                <><span className="font-bold text-gray-900">{recipients.length}</span> recipients
                {channel === "whatsapp" && <> · <span className="font-bold text-gray-900">{withPhone.length}</span> with phone</>}</>
              )}
            </p>
          </div>
        </div>

        {/* RIGHT: compose */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">3. Compose {channel === "email" ? "email" : "WhatsApp message"}</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(TEMPLATES).map((k) => (
                  <button key={k} onClick={() => applyTemplate(k)}
                    className={`rounded px-2 py-1 text-xs capitalize ${tpl === k ? "bg-brand/10 text-brand" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {channel === "email" && (
              <div className="mb-3">
                <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Message</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
                placeholder="Write your message… Use {{name}} and {{ref}} to personalize."
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </label>
            <p className="mt-1 text-xs text-gray-400">Placeholders: <code>{"{{name}}"}</code>, <code>{"{{ref}}"}</code></p>

            {result && <div className="mt-3"><Alert type={result.ok ? "success" : "error"}>{result.msg}</Alert></div>}

            {channel === "email" ? (
              <div className="mt-4">
                <Button onClick={sendEmail} loading={sending} disabled={recipients.length === 0}>
                  Send Email to {recipients.length} students
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <p className="mb-2 text-xs text-gray-500">
                  WhatsApp opens a chat per student (click-to-chat). Click each “Send” to open a pre-filled message.
                  <button onClick={logWhatsApp} className="ml-2 text-brand hover:underline">Mark as sent</button>
                </p>
                <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-100 divide-y">
                  {withPhone.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500">No recipients with a phone number in this audience.</p>
                  ) : withPhone.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{r.name} <span className="text-gray-400">· {r.phone}</span></span>
                      <a href={waLink(r.phone, fill(body, r))} target="_blank" rel="noreferrer"
                        className="rounded bg-green-500 px-3 py-1 text-xs font-semibold text-white hover:bg-green-600">Send</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* History */}
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Recent broadcasts</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No broadcasts yet.</p>
            ) : (
              <div className="divide-y text-sm">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${h.channel === "email" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{h.channel}</span>
                      {h.subject}
                    </span>
                    <span className="text-xs text-gray-400">{h.sent_count}/{h.recipient_count} · {h.created_at ? new Date(h.created_at).toLocaleString() : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
