"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Card } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";

function Stat({ label, value, color }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${color}`}>{value}</p>
    </Card>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/reports/summary", adminAuth.token())
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message));
  }, []);

  const students = data?.studentStats || [];
  const payments = data?.paymentStats || [];
  const colleges = data?.collegeStats || [];

  const totalStudents = students.reduce((a, s) => a + Number(s.count), 0);
  const verified = students.find((s) => s.status === "verified")?.count || 0;
  const revenue = payments
    .filter((p) => p.status === "completed")
    .reduce((a, p) => a + Number(p.total_amount || 0), 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of registrations and revenue" />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Students" value={totalStudents} color="text-brand" />
        <Stat label="Verified" value={verified} color="text-green-600" />
        <Stat label="Pending" value={totalStudents - verified} color="text-amber-600" />
        <Stat label="Revenue (₹)" value={revenue.toLocaleString("en-IN")} color="text-gray-900" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold text-gray-700">College-wise Enrolment</h2>
          <TableWrap>
            <thead className="bg-gray-50">
              <tr><Th>College</Th><Th>Students</Th></tr>
            </thead>
            <tbody className="divide-y">
              {colleges.length === 0 ? (
                <tr><Td className="text-gray-500" >No data</Td><Td></Td></tr>
              ) : colleges.map((c, i) => (
                <tr key={i}><Td>{c.college_name}</Td><Td>{c.student_count}</Td></tr>
              ))}
            </tbody>
          </TableWrap>
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-gray-700">Payments Breakdown</h2>
          <TableWrap>
            <thead className="bg-gray-50">
              <tr><Th>Status</Th><Th>Count</Th><Th>Amount (₹)</Th></tr>
            </thead>
            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr><Td className="text-gray-500">No data</Td><Td></Td><Td></Td></tr>
              ) : payments.map((p, i) => (
                <tr key={i}><Td className="capitalize">{p.status}</Td><Td>{p.count}</Td><Td>{Number(p.total_amount || 0).toLocaleString("en-IN")}</Td></tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </div>
    </>
  );
}
