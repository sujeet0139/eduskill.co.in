"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Select, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { useToast } from "@/components/Toast";

// Dedicated bulk student-to-course/program mapping screen (dev-prompt item
// #26). The per-student EnrollmentManager on the student detail page already
// covers "select a student -> map/demap one at a time" -- this screen adds
// the other half: select MANY students, map them all to one course/program
// in a single action, plus a shared audit trail of every map/demap.
export default function AdminMapping() {
  const [type, setType] = useState("course");
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [itemId, setItemId] = useState("");
  const [batchId, setBatchId] = useState("");

  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [mapping, setMapping] = useState(false);
  const [result, setResult] = useState(null);

  const [log, setLog] = useState([]);
  const [loadingLog, setLoadingLog] = useState(true);

  const token = () => adminAuth.token();
  const notify = useToast();

  useEffect(() => {
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
    api.get("/api/batches", token()).then((d) => setBatches(d.batches || [])).catch(() => {});
    loadLog();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (q) params.set("q", q);
      api.get(`/api/students?${params.toString()}`, token())
        .then((d) => setStudents(d.students || []))
        .catch(() => {});
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const loadLog = () => {
    setLoadingLog(true);
    api.get("/api/students/mapping-audit-log", token())
      .then((d) => setLog(d.log || []))
      .catch(() => {})
      .finally(() => setLoadingLog(false));
  };

  const toggleStudent = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => setSelected(new Set(students.map((s) => s.id)));
  const clearSelection = () => setSelected(new Set());

  const items = type === "course" ? courses : programs;
  const batchesForItem = batches.filter((b) => String(type === "course" ? b.course_id : b.program_id) === String(itemId));

  const mapSelected = async () => {
    if (!itemId) { notify.toast("Select a course/program first."); return; }
    if (selected.size === 0) { notify.toast("Select at least one student."); return; }
    if (!(await notify.confirm(`Map ${selected.size} student(s) to this ${type}?`))) return;
    setMapping(true);
    setResult(null);
    try {
      const res = await api.post("/api/students/bulk-map", {
        studentIds: Array.from(selected), type, item_id: itemId, batch_id: batchId || null,
      }, token());
      setResult(res);
      clearSelection();
      loadLog();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setMapping(false);
    }
  };

  return (
    <>
      <PageHeader title="Course / Program Mapping" subtitle="Bulk-map selected students to a course or program in one action." />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map target */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">1. Map to</h3>
          <div className="space-y-3">
            <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setItemId(""); setBatchId(""); }}>
              <option value="course">Course</option>
              <option value="program">Program</option>
            </Select>
            <Select label={type === "course" ? "Course" : "Program"} value={itemId} onChange={(e) => { setItemId(e.target.value); setBatchId(""); }}>
              <option value="">— Select —</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </Select>
            {batchesForItem.length > 0 && (
              <Select label="Batch (optional)" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">— No batch —</option>
                {batchesForItem.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            )}
          </div>

          <div className="mt-4 border-t pt-4">
            <p className="text-sm text-gray-600">{selected.size} student(s) selected</p>
            <Button onClick={mapSelected} loading={mapping} disabled={!itemId || selected.size === 0} className="mt-2 w-full">
              Map Selected
            </Button>
            {result && (
              <div className="mt-3">
                {result.error ? <Alert type="error">{result.error}</Alert> : <Alert type="success">{result.message}</Alert>}
                {result.errors && (
                  <div className="mt-2 max-h-24 overflow-y-auto text-xs text-red-600">
                    {result.errors.map((e, i) => <div key={i}>Student {e.studentId}: {e.error}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Student picker */}
        <div className="rounded-xl bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">2. Select students</h3>
            <div className="flex items-center gap-2">
              <input
                placeholder="Search name / mobile / email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
              <button onClick={selectAllVisible} className="whitespace-nowrap text-xs font-medium text-brand hover:underline">Select all visible</button>
              <button onClick={clearSelection} className="whitespace-nowrap text-xs font-medium text-gray-500 hover:underline">Clear</button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {students.length === 0 ? (
                  <tr><td className="p-3 text-gray-500">No students found.</td></tr>
                ) : students.map((s) => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${selected.has(s.id) ? "bg-blue-50" : ""}`}>
                    <td className="w-8 p-2">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleStudent(s.id)} />
                    </td>
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2 text-gray-500">{s.email}</td>
                    <td className="p-2 text-gray-500">{s.phone}</td>
                    <td className="p-2 text-gray-500">{s.college_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mapping history / audit log (item #26) */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent mapping activity</h3>
        <TableWrap>
          <thead className="bg-gray-50">
            <tr><Th>When</Th><Th>Student</Th><Th>Action</Th><Th>Type</Th><Th>Item</Th><Th>By</Th></tr>
          </thead>
          <tbody className="divide-y">
            {loadingLog ? (
              <tr><Td className="text-gray-500">Loading…</Td></tr>
            ) : log.length === 0 ? (
              <tr><Td className="text-gray-500">No mapping activity yet.</Td></tr>
            ) : log.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</Td>
                <Td>{l.student_name || `#${l.student_id}`}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.action === "mapped" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {l.action}
                  </span>
                </Td>
                <Td className="capitalize">{l.item_type}</Td>
                <Td>{l.item_title || `#${l.item_id}`}</Td>
                <Td className="text-xs text-gray-500">{l.admin_email || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>
    </>
  );
}
