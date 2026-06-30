"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Input, Select, StatusBadge } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td, Modal } from "@/components/admin";

const EMPTY_EXAM = {
  title: "", type: "quiz", course_id: "", program_id: "", passing_score: 50,
  duration_minutes: 60, fee: 0, weightage_percent: 100, has_negative_marking: false,
  shuffle_questions: false, status: "draft",
};
const EMPTY_Q = { question_text: "", type: "mcq", opt1: "", opt2: "", opt3: "", opt4: "", correct_answer: "", marks: 1, negative_marks: 0 };

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_EXAM);
  const [editId, setEditId] = useState(null);

  // Question manager state
  const [qModal, setQModal] = useState(false);
  const [activeExam, setActiveExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qForm, setQForm] = useState(EMPTY_Q);

  const token = () => adminAuth.token();

  const load = () => {
    api.get("/api/exams", token()).then((d) => setExams(d.exams || [])).catch((e) => setError(e.message));
    api.get("/api/courses", token()).then((d) => setCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setPrograms(d.programs || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const openNew = () => { setForm(EMPTY_EXAM); setEditId(null); setModal(true); };
  const openEdit = (x) => {
    setForm({ ...EMPTY_EXAM, ...x, course_id: x.course_id || "", program_id: x.program_id || "",
      has_negative_marking: !!x.has_negative_marking, shuffle_questions: !!x.shuffle_questions });
    setEditId(x.id); setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, has_negative_marking: !!form.has_negative_marking, shuffle_questions: !!form.shuffle_questions };
      if (editId) await api.put(`/api/exams/${editId}`, payload, token());
      else await api.post("/api/exams", payload, token());
      setModal(false); load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this exam and all its questions?")) return;
    try { await api.del(`/api/exams/${id}`, token()); load(); } catch (e) { alert(e.message); }
  };

  // ---- Question manager ----
  const openQuestions = async (exam) => {
    setActiveExam(exam); setQForm(EMPTY_Q); setQModal(true);
    try {
      const d = await api.get(`/api/exams/${exam.id}`, token());
      setQuestions(d.exam?.questions || []);
    } catch (e) { alert(e.message); }
  };
  const reloadQuestions = async () => {
    const d = await api.get(`/api/exams/${activeExam.id}`, token());
    setQuestions(d.exam?.questions || []);
  };
  const addQuestion = async (e) => {
    e.preventDefault();
    const options = qForm.type === "mcq"
      ? [qForm.opt1, qForm.opt2, qForm.opt3, qForm.opt4].filter(Boolean)
      : qForm.type === "true_false" ? ["True", "False"] : null;
    try {
      await api.post(`/api/exams/${activeExam.id}/questions`, {
        question_text: qForm.question_text, type: qForm.type, options,
        correct_answer: qForm.correct_answer, marks: Number(qForm.marks) || 1, negative_marks: Number(qForm.negative_marks) || 0,
      }, token());
      setQForm(EMPTY_Q); reloadQuestions(); load();
    } catch (err) { alert(err.message); }
  };
  const deleteQuestion = async (qid) => {
    if (!confirm("Delete this question?")) return;
    try { await api.del(`/api/exams/${activeExam.id}/questions/${qid}`, token()); reloadQuestions(); load(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Exams" subtitle={`${exams.length} total`} action={<Button onClick={openNew}>+ New Exam</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <TableWrap>
        <thead className="bg-gray-50">
          <tr><Th>Title</Th><Th>Type</Th><Th>For</Th><Th>Questions</Th><Th>Pass %</Th><Th>Status</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y">
          {exams.length === 0 ? (
            <tr><Td className="text-gray-500">No exams yet.</Td></tr>
          ) : exams.map((x) => (
            <tr key={x.id} className="hover:bg-gray-50">
              <Td className="font-medium">{x.title}</Td>
              <Td className="capitalize">{(x.type || "").replace("_", " ")}</Td>
              <Td>{x.course_title || x.program_title || "—"}</Td>
              <Td>{x.question_count ?? 0}</Td>
              <Td>{x.passing_score}%</Td>
              <Td><StatusBadge status={x.status} /></Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => openQuestions(x)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Questions</button>
                  <button onClick={() => openEdit(x)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Edit</button>
                  <button onClick={() => remove(x.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {/* Create / edit exam */}
      <Modal open={modal} title={editId ? "Edit Exam" : "New Exam"} onClose={() => setModal(false)}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Title *" name="title" value={form.title} onChange={change} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" name="type" value={form.type} onChange={change}>
              <option value="quiz">Quiz</option>
              <option value="mid_term">Mid Term</option>
              <option value="final_exam">Final Exam</option>
              <option value="practice">Practice</option>
            </Select>
            <Select label="Status" name="status" value={form.status} onChange={change}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Course" name="course_id" value={form.course_id} onChange={change}>
              <option value="">— None —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Select label="Program" name="program_id" value={form.program_id} onChange={change}>
              <option value="">— None —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Pass %" type="number" name="passing_score" value={form.passing_score} onChange={change} />
            <Input label="Duration (min)" type="number" name="duration_minutes" value={form.duration_minutes} onChange={change} />
            <Input label="Weightage %" type="number" name="weightage_percent" value={form.weightage_percent} onChange={change} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.has_negative_marking} onChange={(e) => setForm({ ...form, has_negative_marking: e.target.checked })} /> Negative marking
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.shuffle_questions} onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })} /> Shuffle questions
            </label>
          </div>
          <Button type="submit" loading={saving} className="w-full">{editId ? "Update" : "Create"}</Button>
        </form>
      </Modal>

      {/* Question manager */}
      <Modal open={qModal} title={activeExam ? `Questions — ${activeExam.title}` : "Questions"} onClose={() => setQModal(false)}>
        <div className="space-y-4">
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {questions.length === 0 ? (
              <p className="text-sm text-gray-500">No questions yet. Add one below.</p>
            ) : questions.map((q, i) => (
              <div key={q.id} className="flex items-start justify-between rounded-lg border border-gray-200 p-2 text-sm">
                <div>
                  <span className="font-medium">{i + 1}. {q.question_text}</span>
                  <div className="text-xs text-gray-400">{(q.type || "").replace("_", " ")} · {q.marks} mark(s) · ans: {q.correct_answer}</div>
                </div>
                <button onClick={() => deleteQuestion(q.id)} className="ml-2 text-xs font-semibold text-red-600 hover:text-red-800">Delete</button>
              </div>
            ))}
          </div>

          <form onSubmit={addQuestion} className="space-y-3 border-t pt-3">
            <Input label="Question *" name="question_text" value={qForm.question_text} onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })} required />
            <Select label="Type" value={qForm.type} onChange={(e) => setQForm({ ...qForm, type: e.target.value })}>
              <option value="mcq">Multiple Choice</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short Answer</option>
            </Select>
            {qForm.type === "mcq" && (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Option 1" value={qForm.opt1} onChange={(e) => setQForm({ ...qForm, opt1: e.target.value })} />
                <Input placeholder="Option 2" value={qForm.opt2} onChange={(e) => setQForm({ ...qForm, opt2: e.target.value })} />
                <Input placeholder="Option 3" value={qForm.opt3} onChange={(e) => setQForm({ ...qForm, opt3: e.target.value })} />
                <Input placeholder="Option 4" value={qForm.opt4} onChange={(e) => setQForm({ ...qForm, opt4: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Input label="Correct Answer *" value={qForm.correct_answer} onChange={(e) => setQForm({ ...qForm, correct_answer: e.target.value })} required />
              <Input label="Marks" type="number" value={qForm.marks} onChange={(e) => setQForm({ ...qForm, marks: e.target.value })} />
              <Input label="Neg. Marks" type="number" value={qForm.negative_marks} onChange={(e) => setQForm({ ...qForm, negative_marks: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">Add Question</Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
