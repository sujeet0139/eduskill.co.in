"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { useToast } from "@/components/Toast";

// Section G: syllabus topics are defined once per Course and reused across
// every batch taking it; progress (who covered what, when, and how
// students self-confirmed) is tracked per Batch.
export default function AdminSyllabus() {
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const token = () => adminAuth.token();
  const notify = useToast();

  useEffect(() => {
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/batches", token()).then((d) => setBatches(d.batches || [])).catch(() => {});
  }, []);

  const loadTopics = (cid) => {
    if (!cid) { setTopics([]); return; }
    api.get(`/api/syllabus/courses/${cid}/topics`, token()).then((d) => setTopics(d.topics || [])).catch((e) => setError(e.message));
  };
  useEffect(() => loadTopics(courseId), [courseId]);

  const loadProgress = (bid) => {
    if (!bid) { setProgress(null); return; }
    api.get(`/api/syllabus/batches/${bid}/progress`, token()).then(setProgress).catch((e) => setError(e.message));
  };
  useEffect(() => loadProgress(batchId), [batchId]);

  const addTopic = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await api.post(`/api/syllabus/courses/${courseId}/topics`, { title: newTitle.trim() }, token());
      setNewTitle("");
      loadTopics(courseId);
    } catch (err) { notify.error(err.message); }
  };

  const removeTopic = async (id) => {
    if (!(await notify.confirm("Delete this topic? Any progress/confirmations recorded against it for every batch will be removed too."))) return;
    try { await api.del(`/api/syllabus/topics/${id}`, token()); loadTopics(courseId); } catch (e) { notify.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Syllabus" subtitle="Define topics per course, track coverage per batch" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Topic definition, per course */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">1. Define topics for a course</h2>
          <Select label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">— Select a course —</option>
            {courses.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
          </Select>

          {courseId && (
            <>
              <form onSubmit={addTopic} className="mt-3 flex gap-2">
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g., Exception Handling" className="flex-1" />
                <Button type="submit">+ Add</Button>
              </form>
              <div className="mt-3">
                <TableWrap>
                  <thead className="bg-gray-50"><tr><Th>#</Th><Th>Topic</Th><Th>Actions</Th></tr></thead>
                  <tbody className="divide-y">
                    {topics.length === 0 ? (
                      <tr><Td className="text-gray-500">No topics yet.</Td></tr>
                    ) : topics.map((t, i) => (
                      <tr key={t.id}>
                        <Td>{i + 1}</Td>
                        <Td className="font-medium">{t.title}</Td>
                        <Td><button onClick={() => removeTopic(t.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
            </>
          )}
        </div>

        {/* Coverage progress, per batch */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">2. Coverage progress for a batch</h2>
          <Select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">— Select a batch —</option>
            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </Select>

          {progress && (
            <>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>{progress.summary.completed} of {progress.summary.total} topics completed</span>
                  <span>{progress.summary.total ? Math.round((progress.summary.completed / progress.summary.total) * 100) : 0}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-brand" style={{ width: `${progress.summary.total ? (progress.summary.completed / progress.summary.total) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="mt-3 divide-y">
                {progress.topics.map((t) => (
                  <div key={t.id} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t.title}</span>
                      <span className="text-xs text-gray-500">
                        {t.status === "completed" ? "🟢" : t.status === "in_progress" ? "🟡" : "⚪"} {t.status.replace("_", " ")}
                      </span>
                    </div>
                    {t.covered_by_name && <p className="text-xs text-gray-400">Covered by {t.covered_by_name} on {new Date(t.covered_at).toLocaleDateString()}</p>}
                    {t.total_confirmations > 0 && (
                      <p className={`mt-0.5 text-xs ${t.needs_revision_alert ? "font-semibold text-red-600" : "text-gray-500"}`}>
                        {t.got_it_count} 🟢 · {t.need_revision_count} 🟡 · {t.didnt_attend_count} ⚪
                        {t.needs_revision_alert && " — ⚠ 30%+ need revision"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
