"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const token = () => adminAuth.token();

  const load = () => {
    setLoading(true);
    api.get("/api/students", token())
      .then((d) => setStudents(d.students || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const verify = async (id) => {
    try { await api.put(`/api/students/${id}/verify`, {}, token()); load(); }
    catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    try { await api.del(`/api/students/${id}`, token()); load(); }
    catch (e) { alert(e.message); }
  };

  const filtered = students.filter((s) =>
    [s.name, s.email, s.reference_no, s.phone].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${students.length} registered`}
        action={
          <input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        }
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Ref</Th><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>College</Th><Th>Status</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><Td className="text-gray-500">Loading…</Td></tr>
          ) : filtered.length === 0 ? (
            <tr><Td className="text-gray-500">No students found.</Td></tr>
          ) : filtered.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <Td className="font-mono text-xs">{s.reference_no}</Td>
              <Td className="font-medium">{s.name}</Td>
              <Td>{s.email}</Td>
              <Td>{s.phone}</Td>
              <Td className="max-w-[180px] truncate" >{s.college_name}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  {s.status !== "verified" && (
                    <button onClick={() => verify(s.id)} className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">
                      Verify
                    </button>
                  )}
                  <button onClick={() => remove(s.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}
