"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { studentAuth } from "@/lib/auth";
import InstituteConnect from "@/components/InstituteConnect";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fileHref = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${api.base}${p}`);

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [payments, setPayments] = useState([]);
  const [certs, setCerts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [syllabusTopics, setSyllabusTopics] = useState([]);
  const [payInfo, setPayInfo] = useState({});
  const [loading, setLoading] = useState(true);

  // Pay modal state
  const [payItem, setPayItem] = useState(null); // {type,id,title,price,min,paid,balance}
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("choose");
  const [paymentId, setPaymentId] = useState(null);
  const [dueNow, setDueNow] = useState(0);
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [slip, setSlip] = useState(null); // a payment object to show as a receipt

  const token = () => studentAuth.token();

  const loadAll = () => {
    api.get("/api/student-dashboard/profile", token()).then((d) => setStudent(d.profile)).catch(() => {
      studentAuth.logout(); router.replace("/login");
    });
    api.get("/api/courses").then((d) => setCourses((d.courses || []).filter((c) => c.status === "active"))).catch(() => {});
    api.get("/api/programs").then((d) => setPrograms((d.programs || []).filter((p) => p.status === "active"))).catch(() => {});
    api.get("/api/student-dashboard/certificates", token()).then((d) => setCerts(d.certificates || [])).catch(() => {});
    api.get("/api/student-dashboard/assignments", token()).then((d) => setAssignments(d.assignments || [])).catch(() => {});
    api.get("/api/student-dashboard/materials", token()).then((d) => setMaterials(d.materials || [])).catch(() => {});
    api.get("/api/student-dashboard/live-classes", token()).then((d) => setLiveClasses(d.classes || [])).catch(() => {});
    api.get("/api/student-dashboard/syllabus", token()).then((d) => setSyllabusTopics(d.topics || [])).catch(() => {});
    api.get("/api/public/payment-info").then((d) => setPayInfo(d.payment || {})).catch(() => {});
  };

  const loadAssignments = () =>
    api.get("/api/student-dashboard/assignments", token()).then((d) => setAssignments(d.assignments || [])).catch(() => {});

  const loadPayments = (sid) =>
    api.get(`/api/payments?student_id=${sid}`).then((d) => setPayments(d.payments || [])).catch(() => {});

  // Section G item 3 -- one tap, no text field, or response rates collapse.
  const confirmTopic = async (topic, confirmation) => {
    try {
      await api.post(`/api/student-dashboard/syllabus/${topic.topic_id}/confirm`, { batch_id: topic.batch_id, confirmation }, token());
      setSyllabusTopics((prev) => prev.map((t) => (t.topic_id === topic.topic_id && t.batch_id === topic.batch_id) ? { ...t, confirmation } : t));
    } catch { /* leave the tap unconfirmed on failure so the student can retry, rather than showing a false success */ }
  };

  useEffect(() => {
    if (!studentAuth.token()) { router.replace("/login"); return; }
    loadAll();
    setLoading(false);
  }, []);

  useEffect(() => { if (student?.id) loadPayments(student.id); }, [student?.id]);

  const logout = async () => {
    try { await api.post("/api/auth/logout"); } catch {}
    studentAuth.logout();
    router.push("/login");
  };

  // How much has been APPROVED for a given item
  const paidFor = (type, id) =>
    payments.filter((p) => p.payment_for_type === type && String(p.payment_for_id) === String(id) && p.status === "completed")
      .reduce((s, p) => s + Number(p.amount), 0);

  // ---- Payment flow ----
  const openPay = (type, item) => {
    const price = type === "course" ? Number(item.price || 0) : Number(item.fee || 0);
    const min = Number(item.min_payment || 0);
    const paid = paidFor(type, item.id);
    const balance = Math.max(0, price - paid);
    setPayItem({ type, id: item.id, title: item.title, price, min, paid, balance, content_pdf: item.content_pdf });
    setAmount(balance ? String(balance) : "");
    setStage("choose"); setPaymentId(null); setTxnId(""); setFile(null); setMsg("");
  };

  const initiate = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await api.post("/api/payments/initiate", {
        student_id: student.id, item_type: payItem.type, item_id: payItem.id, amount: Number(amount),
      });
      if (res.payment_type === "wallet") {
        setMsg("Enrolled using your wallet balance!"); setStage("done"); loadPayments(student.id);
      } else {
        setPaymentId(res.payment_id); setDueNow(res.amount_due); setStage("pay");
      }
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const submitProof = async (e) => {
    e.preventDefault();
    if (!file) { setMsg("Please attach your payment screenshot."); return; }
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("screenshot", file);
      fd.append("transaction_id", txnId);
      await api.postForm(`/api/payments/${paymentId}/upload-proof`, fd, token());
      setStage("done"); loadPayments(student.id);
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const closePay = () => setPayItem(null);

  if (loading) {
    return <main className="flex min-h-[70vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" /></main>;
  }

  const items = [
    ...programs.map((p) => ({ ...p, _type: "program", _price: Number(p.fee || 0) })),
    ...courses.map((c) => ({ ...c, _type: "course", _price: Number(c.price || 0) })),
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:py-10 md:pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
            {(student?.name || "S").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Hi, {student?.name || "Student"} 👋</h1>
            <p className="text-sm text-blue-200">Ref: {student?.reference_no} · Status: <span className="capitalize">{student?.status}</span></p>
          </div>
        </div>
        <button onClick={logout} className="rounded-lg bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25">Logout</button>
      </div>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Courses", value: courses.length + programs.length },
          { label: "Assignments", value: assignments.length },
          { label: "Certificates", value: certs.length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
            <div className="text-2xl font-extrabold text-blue-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Enroll & Pay */}
      <section id="s-home" className="mt-8 scroll-mt-4">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Programs & Courses</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const paid = paidFor(item._type, item.id);
            const balance = Math.max(0, item._price - paid);
            const enrolled = paid > 0;
            return (
              <div key={`${item._type}-${item.id}`} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
                <span className="mb-2 inline-block w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-800">{item._type}</span>
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                {item.subject && <p className="text-xs text-gray-400">{item.subject}</p>}
                <p className="mt-1 flex-1 text-sm text-gray-500 line-clamp-2">{item.description || ""}</p>

                <div className="mt-3 text-lg font-bold text-blue-900">{item._price ? money(item._price) : "Free"}</div>
                {enrolled && (
                  <p className="text-xs text-gray-500">Paid {money(paid)}{balance > 0 ? ` · Balance ${money(balance)}` : " · Fully paid ✓"}</p>
                )}
                {!enrolled && Number(item.min_payment) > 0 && <p className="text-xs text-gray-400">Pay min {money(item.min_payment)} to start</p>}

                {item._type === "course" && item.content_pdf && enrolled && (
                  <a href={fileHref(item.content_pdf)} target="_blank" rel="noreferrer" className="mt-2 text-sm font-medium text-brand hover:underline">📄 Course Content (PDF)</a>
                )}

                {balance > 0 ? (
                  <button onClick={() => openPay(item._type, item)} className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                    {enrolled ? "Pay Remaining" : "Enroll / Pay"}
                  </button>
                ) : enrolled ? (
                  <span className="mt-3 rounded-lg bg-green-100 px-4 py-2 text-center text-sm font-semibold text-green-700">Enrolled ✓</span>
                ) : (
                  <button onClick={() => openPay(item._type, item)} className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Enroll</button>
                )}
              </div>
            );
          })}
          {items.length === 0 && <p className="text-sm text-gray-500">No programs or courses available yet.</p>}
        </div>
      </section>

      {/* Payments history */}
      <section id="s-pay" className="mt-10 scroll-mt-4">
        <h2 className="mb-3 text-lg font-bold text-gray-900">My Payments</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">For</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Slip</th></tr>
            </thead>
            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-4 text-center text-gray-500">No payments yet.</td></tr>
              ) : payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{money(p.amount)}</td>
                  <td className="px-4 py-2">{p.payment_for_type}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "completed" ? "bg-green-100 text-green-800" : p.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                    }`}>{p.status === "pending" ? "awaiting verification" : p.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => setSlip(p)} className="text-brand hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Certificates */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-gray-900">My Certificates</h2>
        {certs.length === 0 ? (
          <p className="text-sm text-gray-500">No certificates issued yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {certs.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-mono text-xs text-gray-500">{c.certificate_no}</p>
                <Link href={`/verify/${c.certificate_no}`} className="mt-2 inline-block rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">View / Download →</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Assignments */}
      <section id="s-tasks" className="mt-10 scroll-mt-4">
        <h2 className="mb-3 text-lg font-bold text-gray-900">My Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">No assignments shared with you yet.</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <AssignmentCard key={a.id} a={a} token={token()} onSubmitted={loadAssignments} />
            ))}
          </div>
        )}
      </section>

      {/* Live Classes */}
      <section id="s-classes" className="mt-10 scroll-mt-4">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Live Classes</h2>
        {liveClasses.length === 0 ? (
          <p className="text-sm text-gray-500">No live classes scheduled.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {liveClasses.map((c) => {
              const when = c.scheduled_at ? new Date(c.scheduled_at) : null;
              const upcoming = when && when > new Date();
              return (
                <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{c.title}</p>
                      <p className="text-xs text-gray-500">{c.topic}{c.mentor_name ? ` · ${c.mentor_name}` : ""}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${upcoming ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {upcoming ? "Upcoming" : (c.status || "past")}
                    </span>
                  </div>
                  {when && <p className="mt-1 text-xs text-gray-500">{when.toLocaleString()}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.meet_link && upcoming && <a href={c.meet_link} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">Join Class</a>}
                    {c.recording_url && <a href={c.recording_url} target="_blank" rel="noreferrer" className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Recording</a>}
                    {c.materials_url && <a href={c.materials_url} target="_blank" rel="noreferrer" className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Materials</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Study Materials (gated to enrolled courses/programs + general) */}
      <section id="s-materials" className="mt-10 scroll-mt-4">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Study Materials</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-gray-500">No materials available yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((m) => m.video_url ? (
              <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900">{m.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {m.subject ? m.subject : (m.course_title || m.program_title || m.category || "General")}
                </p>
                {m.description && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{m.description}</p>}
                <div className="mt-2 aspect-video overflow-hidden rounded-lg">
                  <iframe src={m.video_url} title={m.title} allowFullScreen className="h-full w-full" />
                </div>
              </div>
            ) : (
              <a key={m.id} href={api.mediaUrl(m.file_path)} target="_blank" rel="noreferrer"
                className="rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-md">
                <p className="font-semibold text-gray-900">{m.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {m.subject ? m.subject : (m.course_title || m.program_title || m.category || "General")}
                </p>
                {m.description && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{m.description}</p>}
                <span className="mt-2 inline-block text-sm font-medium text-brand">Open →</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Syllabus self-confirmation (topics the teacher has marked covered) */}
      {syllabusTopics.length > 0 && (
        <section id="s-syllabus" className="mt-10 scroll-mt-4">
          <h2 className="mb-3 text-lg font-bold text-gray-900">Topics Covered — Confirm Your Understanding</h2>
          <div className="space-y-2">
            {syllabusTopics.map((t) => (
              <div key={`${t.batch_id}-${t.topic_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
                <span className="text-sm font-medium text-gray-900">{t.title}</span>
                <div className="flex gap-1.5">
                  {[["got_it", "🟢 Got it"], ["need_revision", "🟡 Need revision"], ["didnt_attend", "⚪ Didn't attend"]].map(([val, label]) => (
                    <button key={val} onClick={() => confirmTopic(t, val)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${t.confirmation === val ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <InstituteConnect />

      {/* Pay modal */}
      {payItem && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={closePay}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{payItem.title}</h3>
              <button onClick={closePay} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {msg && <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{msg}</div>}

            {stage === "choose" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Total: <strong>{money(payItem.price)}</strong>
                  {payItem.paid > 0 && <> · Paid: <strong>{money(payItem.paid)}</strong> · Balance: <strong>{money(payItem.balance)}</strong></>}
                  {payItem.paid === 0 && payItem.min > 0 && <> · Minimum: <strong>{money(payItem.min)}</strong></>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setAmount(String(payItem.balance))} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">{payItem.paid > 0 ? "Full balance" : "Full"} {money(payItem.balance)}</button>
                  {payItem.paid === 0 && payItem.min > 0 && <button type="button" onClick={() => setAmount(String(payItem.min))} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">Minimum {money(payItem.min)}</button>}
                  {payItem.balance > 1 && <button type="button" onClick={() => setAmount(String(Math.ceil(payItem.balance / 2)))} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">Half {money(Math.ceil(payItem.balance / 2))}</button>}
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Amount to pay now (₹)</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={payItem.balance || undefined}
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" />
                </label>
                <button onClick={initiate} disabled={busy} className="w-full rounded-lg bg-blue-900 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400">
                  {busy ? "Please wait…" : "Continue to Pay"}
                </button>
              </div>
            )}

            {stage === "pay" && (
              <form onSubmit={submitProof} className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-4 text-center">
                  <p className="text-sm text-blue-800">Pay <strong>{money(dueNow)}</strong> using any UPI app</p>
                  {payInfo.payment_upi_id && <p className="mt-1 font-mono text-sm font-semibold text-blue-900">{payInfo.payment_upi_id}</p>}
                  {payInfo.payment_upi_qr_url && <img src={fileHref(payInfo.payment_upi_qr_url)} alt="UPI QR" className="mx-auto mt-3 h-40 w-40 rounded-lg border bg-white object-contain p-1" />}
                  {payInfo.payment_bank_details && <pre className="mt-3 whitespace-pre-wrap text-left text-xs text-gray-600">{payInfo.payment_bank_details}</pre>}
                  {!payInfo.payment_upi_id && !payInfo.payment_upi_qr_url && <p className="mt-2 text-xs text-gray-500">Payment details not configured. Please contact support.</p>}
                </div>
                <p className="text-xs text-gray-500">After paying, enter your UPI transaction ID and upload a screenshot. Admin will verify and confirm your enrolment.</p>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">UPI Transaction ID</span>
                  <input value={txnId} onChange={(e) => setTxnId(e.target.value)} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Payment Screenshot *</span>
                  <input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-3 file:py-1.5 file:text-white" />
                </label>
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:bg-gray-400">
                  {busy ? "Submitting…" : "Submit for Verification"}
                </button>
              </form>
            )}

            {stage === "done" && (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
                <p className="font-semibold text-gray-900">Submitted!</p>
                <p className="mt-1 text-sm text-gray-500">Your payment is awaiting admin verification. You'll be enrolled once it's approved.</p>
                <button onClick={closePay} className="mt-4 rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white hover:bg-blue-800">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment slip / receipt */}
      {slip && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 print:bg-white print:p-0" onClick={() => setSlip(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl print:max-w-full print:shadow-none" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between print:hidden">
              <h3 className="text-lg font-semibold">Payment Slip</h3>
              <button onClick={() => setSlip(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div id="slip" className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm">
              <div className="mb-3 text-center">
                <div className="text-base font-bold text-blue-900">EduSkill.co.in</div>
                <div className="text-xs text-gray-500">Payment Receipt</div>
              </div>
              <Row k="Receipt No" v={`PAY-${slip.id}`} />
              <Row k="Student" v={student?.name} />
              <Row k="Reference" v={student?.reference_no} />
              <Row k="For" v={slip.payment_for_type} />
              <Row k="Amount" v={money(slip.amount)} />
              <Row k="Method" v={slip.payment_method} />
              <Row k="Txn ID" v={slip.transaction_id || "—"} />
              <Row k="Date" v={new Date(slip.created_at).toLocaleString()} />
              <Row k="Status" v={slip.status} />
            </div>
            <button onClick={() => window.print()} className="mt-4 w-full rounded-lg bg-blue-900 px-4 py-2 font-semibold text-white hover:bg-blue-800 print:hidden">🖨️ Print / Save PDF</button>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar — makes the panel feel like an app */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-gray-200 bg-white/95 py-1.5 backdrop-blur md:hidden">
        {[
          { href: "#s-home", label: "Home", icon: "🏠" },
          { href: "#s-classes", label: "Classes", icon: "🎥" },
          { href: "#s-tasks", label: "Tasks", icon: "📝" },
          { href: "#s-materials", label: "Learn", icon: "📚" },
          { href: "#s-pay", label: "Pay", icon: "💳" },
        ].map((t) => (
          <a key={t.href} href={t.href} className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium text-gray-600 hover:text-blue-900">
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </main>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1.5 last:border-0">
      <span className="text-gray-500">{k}</span>
      <span className="font-medium text-gray-800 capitalize">{v || "—"}</span>
    </div>
  );
}

// One assignment card with inline submit (file and/or text). Shows grade &
// feedback once graded.
function AssignmentCard({ a, token, onSubmitted }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState(a.text_answer || "");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const submitted = !!a.submission_id;
  const due = a.due_date ? new Date(a.due_date) : null;
  const overdue = due && due < new Date() && a.submission_status !== "approved";

  const submit = async () => {
    if (!file && !text.trim()) { alert("Attach a file or write an answer."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (text.trim()) fd.append("text_answer", text.trim());
      await api.postForm(`/api/student-dashboard/assignments/${a.id}/submit`, fd, token);
      setOpen(false);
      onSubmitted && onSubmitted();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  const statusColor = {
    approved: "bg-green-100 text-green-700",
    revision: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700",
    pending: "bg-blue-100 text-blue-700",
  }[a.submission_status] || "bg-gray-100 text-gray-600";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{a.title}</p>
          <p className="text-xs text-gray-500">
            {a.course_title || a.program_title || "General"}
            {due && <> · Due {due.toLocaleDateString()}</>}
            {a.max_marks && <> · {a.max_marks} marks</>}
          </p>
        </div>
        {submitted ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {a.submission_status}{a.marks != null ? ` · ${a.marks}/${a.max_marks}` : ""}
          </span>
        ) : (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
            {overdue ? "Overdue" : "Not submitted"}
          </span>
        )}
      </div>

      {a.description && <p className="mt-2 text-sm text-gray-600">{a.description}</p>}
      {a.feedback && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Feedback: {a.feedback}</p>}

      <div className="mt-3">
        {!open ? (
          <button onClick={() => setOpen(true)} className="rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
            {submitted ? "Re-submit" : "Submit"}
          </button>
        ) : (
          <div className="space-y-2">
            {a.submission_type !== "text" && (
              <input type="file" onChange={(e) => setFile(e.target.files?.[0])}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-3 file:py-1.5 file:text-white" />
            )}
            {a.submission_type !== "file" && (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Type your answer…"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" />
            )}
            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400">
                {busy ? "Submitting…" : "Send"}
              </button>
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
