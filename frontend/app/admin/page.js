"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, Wallet, Clock, GraduationCap, TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym) => { if (!ym) return ""; const [y, m] = ym.split("-"); return `${MONTHS[Number(m)]} ${y.slice(2)}`; };
const STATUS_COLORS = { completed: "#16a34a", pending: "#f59e0b", failed: "#dc2626" };

function Kpi({ label, value, sub, delta, Icon, tint }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}><Icon size={20} /></div>
      </div>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      {delta !== undefined && delta !== null && (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
          {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {Math.abs(delta)}% vs last month
        </p>
      )}
    </div>
  );
}

function ChartCard({ title, action, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      <div style={{ width: "100%", height: 240 }}>{children}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [finance, setFinance] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");
  const token = () => adminAuth.token();

  useEffect(() => {
    api.get("/api/reports/summary", token()).then((d) => setSummary(d.data)).catch((e) => setError(e.message));
    api.get("/api/payments/finance-summary", token()).then((d) => setFinance(d.data)).catch(() => {});
    api.get("/api/reports/activity", token()).then((d) => setActivity(d.data)).catch(() => {});
  }, []);

  const students = summary?.studentStats || [];
  const totalStudents = students.reduce((a, s) => a + Number(s.count), 0);
  const verified = Number(students.find((s) => s.status === "verified")?.count || 0);

  const t = finance?.totals || {};
  const delta = Number(t.last_month) > 0
    ? Math.round(((Number(t.this_month) - Number(t.last_month)) / Number(t.last_month)) * 100) : null;

  const enrolData = (summary?.monthlyRegistrations || []).map((m) => ({ month: MONTHS[m.month] || m.month, count: Number(m.count) }));
  const revData = (finance?.monthly || []).map((m) => ({ month: monthLabel(m.month), revenue: Number(m.revenue) }));
  const statusData = (finance?.byStatus || []).map((s) => ({ name: s.status, value: Number(s.amount) }));
  const collegeData = (summary?.collegeStats || []).slice(0, 6).map((c) => ({ name: (c.college_name || "—").slice(0, 14), students: Number(c.student_count) }));
  const att = activity?.attention || {};

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of registrations, revenue and what needs your attention.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total Students" value={totalStudents} sub={`${verified} verified`} Icon={Users} tint="bg-blue-50 text-blue-600" />
        <Kpi label="Revenue This Month" value={inr(t.this_month)} delta={delta} Icon={Wallet} tint="bg-green-50 text-green-600" />
        <Kpi label="Pending Approvals" value={t.pending_count || 0} sub={inr(t.pending_amount)} Icon={Clock} tint="bg-amber-50 text-amber-600" />
        <Kpi label="Total Collected" value={inr(t.total_collected)} sub="all-time" Icon={GraduationCap} tint="bg-indigo-50 text-indigo-600" />
      </div>

      {/* Needs attention */}
      {(att.pendingPayments > 0 || att.pendingDocs > 0 || att.classesToday > 0) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {att.pendingPayments > 0 && (
            <Link href="/admin/payments" className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100">
              ⏳ {att.pendingPayments} payment{att.pendingPayments > 1 ? "s" : ""} awaiting approval →
            </Link>
          )}
          {att.pendingDocs > 0 && (
            <Link href="/admin/students" className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 ring-1 ring-blue-100 hover:bg-blue-100">
              📄 {att.pendingDocs} document{att.pendingDocs > 1 ? "s" : ""} to verify →
            </Link>
          )}
          {att.classesToday > 0 && (
            <Link href="/admin/live-classes" className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-800 ring-1 ring-green-100 hover:bg-green-100">
              🎥 {att.classesToday} live class{att.classesToday > 1 ? "es" : ""} today →
            </Link>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue — last 12 months">
            <ResponsiveContainer>
              <AreaChart data={revData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
        <ChartCard title="Payments by status">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="New registrations (this year)">
          <ResponsiveContainer>
            <BarChart data={enrolData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0891b2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top colleges by enrolment">
          <ResponsiveContainer>
            <BarChart data={collegeData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="students" fill="#4f46e5" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recent activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Recent registrations</h3>
          <div className="divide-y text-sm">
            {(activity?.registrations || []).length === 0 ? <p className="text-gray-400">No data</p> :
              activity.registrations.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-800">{r.name}</span>
                  <span className="text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Recent payments</h3>
          <div className="divide-y text-sm">
            {(activity?.recentPayments || []).length === 0 ? <p className="text-gray-400">No data</p> :
              activity.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-800">{p.student_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-gray-600">{inr(p.amount)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.status === "completed" ? "bg-green-100 text-green-700" : p.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
