"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { StatusBadge, Button, Input } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";
import { useToast } from "@/components/Toast";

const fileHref = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${api.base}${p}`);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
};

const STATUS_COLORS = { completed: "#16a34a", pending: "#f59e0b", failed: "#dc2626" };
const CAT_COLORS = ["#4f46e5", "#0891b2", "#db2777", "#ca8a04", "#059669"];

function Kpi({ label, value, sub, accent = "text-gray-900", ring = "ring-gray-100" }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${ring}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      <div style={{ width: "100%", height: 240 }}>{children}</div>
    </div>
  );
}

function waLink(phone, msg) {
  const num = String(phone || "").replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  return num ? `https://wa.me/91${num}?text=${encodeURIComponent(msg)}` : null;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("queue"); // queue | all
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modal, setModal] = useState(false);
  const [manual, setManual] = useState({ studentId: "", amount: "1000", referenceNo: "", paymentDate: "" });

  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState("");

  const token = () => adminAuth.token();
  const notify = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/api/payments/all", token()).then((d) => setPayments(d.payments || [])),
      api.get("/api/payments/finance-summary", token()).then((d) => setSummary(d.data)).catch(() => {}),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const approve = async (p) => {
    if (!(await notify.confirm(`Approve payment of ${inr(p.amount)} from ${p.name}?`))) return;
    try {
      await api.post(`/api/payments/${p.id}/approve`, { transaction_id: p.transaction_id || "" }, token());
      notify.success("Payment approved & student enrolled."); load();
    } catch (e) { notify.error(e.message); }
  };
  const doReject = async () => {
    try {
      await api.post(`/api/payments/${rejecting.id}/reject`, { notes: rejectNote || "Rejected by admin" }, token());
      setRejecting(null); setRejectNote(""); notify.success("Payment rejected."); load();
    } catch (e) { notify.error(e.message); }
  };
  const addManual = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/payments/manual", manual, token());
      setModal(false);
      setManual({ studentId: "", amount: "1000", referenceNo: "", paymentDate: "" });
      notify.success("Manual payment recorded."); load();
    } catch (err) { notify.error(err.message); }
  };

  const pending = useMemo(() => payments.filter((p) => p.status === "pending"), [payments]);
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (q) {
        const hay = [p.name, p.email, p.reference_no, p.transaction_id].join(" ").toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [payments, statusFilter, q]);

  const t = summary?.totals || {};
  const delta = Number(t.last_month) > 0
    ? Math.round(((Number(t.this_month) - Number(t.last_month)) / Number(t.last_month)) * 100)
    : null;

  const trendData = (summary?.monthly || []).map((m) => ({ month: monthLabel(m.month), revenue: Number(m.revenue) }));
  const statusData = (summary?.byStatus || []).map((s) => ({ name: s.status, value: Number(s.amount), count: s.count }));
  const catData = (summary?.byCategory || []).map((c) => ({ name: c.type || "other", amount: Number(c.amount) }));

  const rowActions = (p) => (
    <div className="flex flex-wrap gap-1.5">
      {p.status === "pending" && (
        <button onClick={() => approve(p)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Approve</button>
      )}
      {p.status !== "failed" && (
        <button onClick={() => { setRejecting(p); setRejectNote(""); }} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Reject</button>
      )}
      {p.status === "pending" && p.phone && waLink(p.phone, `Hi ${p.name}, we haven't received/confirmed your payment of ${inr(p.amount)} (Ref ${p.reference_no}). Please complete it or share the payment proof. — EduSkill`) && (
        <a href={waLink(p.phone, `Hi ${p.name}, we haven't received/confirmed your payment of ${inr(p.amount)} (Ref ${p.reference_no}). Please complete it or share the payment proof. — EduSkill`)} target="_blank" rel="noreferrer" className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200">WhatsApp</a>
      )}
    </div>
  );

  const table = (rows) => (
    <TableWrap>
      <thead className="bg-gray-50">
        <tr><Th>Student</Th><Th>Ref</Th><Th>Amount</Th><Th>For</Th><Th>Txn ID</Th><Th>Proof</Th><Th>Status</Th><Th>Date</Th><Th>Actions</Th></tr>
      </thead>
      <tbody className="divide-y">
        {loading ? (
          <tr><Td className="text-gray-500">Loading…</Td></tr>
        ) : rows.length === 0 ? (
          <tr><Td className="text-gray-500">Nothing here.</Td></tr>
        ) : rows.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50">
            <Td className="font-medium">{p.name}<div className="text-xs text-gray-500">{p.email}</div></Td>
            <Td className="font-mono text-xs">{p.reference_no}</Td>
            <Td className="font-semibold">{inr(p.amount)}</Td>
            <Td className="text-xs capitalize">{p.payment_for_type || "—"}</Td>
            <Td className="text-xs">{p.transaction_id || "—"}</Td>
            <Td>{p.screenshot ? <a href={fileHref(p.screenshot)} target="_blank" rel="noreferrer" className="text-brand hover:underline">View</a> : "—"}</Td>
            <Td><StatusBadge status={p.status} /></Td>
            <Td className="text-xs text-gray-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : "—")}</Td>
            <Td>{rowActions(p)}</Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Payments, approvals & revenue"
        action={<Button onClick={() => setModal(true)}>+ Manual Payment</Button>}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total Collected" value={inr(t.total_collected)} accent="text-brand" ring="ring-brand/10" />
        <Kpi
          label="This Month"
          value={inr(t.this_month)}
          accent="text-green-600"
          sub={delta === null ? "—" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs last month`}
        />
        <Kpi label="Pending Approvals" value={t.pending_count || 0} sub={inr(t.pending_amount)} accent="text-amber-600" />
        <Kpi label="Outstanding (EMI)" value={inr(summary?.outstanding?.outstanding)} sub={`${summary?.outstanding?.due_count || 0} installments due`} accent="text-gray-900" />
      </div>

      {/* Charts */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue — last 12 months">
            <ResponsiveContainer>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => inr(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="By status">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {statusData.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] || "#94a3b8"} />)}
              </Pie>
              <Legend />
              <Tooltip formatter={(v) => inr(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {catData.length > 0 && (
        <div className="mt-4">
          <ChartCard title="Revenue by category">
            <ResponsiveContainer>
              <BarChart data={catData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => inr(v)} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {catData.map((c, i) => <Cell key={c.name} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-2 border-b">
        <button onClick={() => setTab("queue")} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "queue" ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Approvals Queue {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pending.length}</span>}
        </button>
        <button onClick={() => setTab("all")} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "all" ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          All Payments
        </button>
      </div>

      <div className="mt-4">
        {tab === "queue" ? (
          table(pending)
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <input placeholder="Search name, email, ref, txn…" value={q} onChange={(e) => setQ(e.target.value)}
                className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border-2 border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none">
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {table(filtered)}
          </>
        )}
      </div>

      {/* Manual payment */}
      <Modal open={modal} title="Add Manual Payment" onClose={() => setModal(false)}>
        <form onSubmit={addManual} className="space-y-3">
          <Input label="Student ID *" value={manual.studentId} onChange={(e) => setManual({ ...manual, studentId: e.target.value })} required />
          <Input label="Amount (₹)" type="number" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
          <Input label="Reference / Mode" value={manual.referenceNo} onChange={(e) => setManual({ ...manual, referenceNo: e.target.value })} />
          <Input label="Payment Date" type="date" value={manual.paymentDate} onChange={(e) => setManual({ ...manual, paymentDate: e.target.value })} />
          <Button type="submit" className="w-full">Save Payment</Button>
        </form>
      </Modal>

      {/* Reject reason */}
      <Modal open={!!rejecting} title="Reject / Refund Payment" onClose={() => setRejecting(null)}>
        <p className="mb-3 text-sm text-gray-600">{rejecting?.name} — {inr(rejecting?.amount)}</p>
        <Input label="Reason (optional)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="e.g., proof invalid / duplicate" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setRejecting(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={doReject} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Confirm Reject</button>
        </div>
      </Modal>
    </>
  );
}
