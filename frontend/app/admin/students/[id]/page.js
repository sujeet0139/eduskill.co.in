"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Card, StatusBadge, Alert, Select } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { User, Banknote, BookOpen, FileText, GraduationCap, TrendingUp } from "lucide-react";
import { useToast } from "@/components/Toast";

const DetailItem = ({ label, value, children }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <div className="text-sm font-medium text-gray-800">{children || value || "—"}</div>
  </div>
);

export default function StudentProfilePage() {
  const params = useParams();
  const studentId = params.id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  // Enrollment management state
  const [enroll, setEnroll] = useState({ courses: [], programs: [] });
  const [allCourses, setAllCourses] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [newCourse, setNewCourse] = useState({ item_id: "", batch_id: "" });
  const [newProgram, setNewProgram] = useState({ item_id: "", batch_id: "" });

  // Expanded profile fields (item #12) — inline edit form, only sends the
  // fields on this form so it can never wipe unrelated columns (see the
  // partial-update PUT /:id on the backend).
  const [editingExtra, setEditingExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({});
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraError, setExtraError] = useState("");

  // Educational background (item #13)
  const [eduForm, setEduForm] = useState({ level: "10th", board_university: "", stream: "", degree_name: "", institution: "", year_of_passing: "", percentage_or_cgpa: "" });
  const [eduFile, setEduFile] = useState(null);
  const [eduSaving, setEduSaving] = useState(false);
  const [eduError, setEduError] = useState("");
  const [progressData, setProgressData] = useState(null);

  const token = () => adminAuth.token();
  const notify = useToast();

  const loadProfile = () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    api.get(`/api/students/${studentId}/full-profile`, token())
      .then((res) => setProfile(res.profile))
      .catch((err) => setError("Failed to load student profile: " + err.message))
      .finally(() => setLoading(false));
  };

  const loadEnrollments = () => {
    if (!studentId) return;
    api.get(`/api/students/${studentId}/enrollments`, token())
      .then((res) => setEnroll({ courses: res.courses || [], programs: res.programs || [] }))
      .catch(() => {});
  };

  useEffect(() => {
    loadProfile();
    loadEnrollments();
    api.get("/api/courses", token()).then((d) => setAllCourses(d.courses || [])).catch(() => {});
    api.get("/api/programs", token()).then((d) => setAllPrograms(d.programs || [])).catch(() => {});
    api.get("/api/batches", token()).then((d) => setAllBatches(d.batches || [])).catch(() => {});
    api.get(`/api/progress/students/${studentId}`, token()).then(setProgressData).catch(() => {});
  }, [studentId]);

  const doEnroll = async (type, item_id, batch_id, status) => {
    if (!item_id) { notify.toast("Select an item first."); return; }
    try {
      await api.post(`/api/students/${studentId}/enroll`, { type, item_id, batch_id: batch_id || null, status }, token());
      loadEnrollments();
      if (type === "course") setNewCourse({ item_id: "", batch_id: "" });
      else setNewProgram({ item_id: "", batch_id: "" });
    } catch (e) { notify.error(e.message); }
  };
  const unenroll = async (type, item_id) => {
    if (!(await notify.confirm("Remove this enrollment?"))) return;
    try {
      await api.del(`/api/students/${studentId}/enroll?type=${type}&item_id=${item_id}`, token());
      loadEnrollments();
    } catch (e) { notify.error(e.message); }
  };

  const verifyStudent = async () => {
    if (!(await notify.confirm("Mark this student as verified?"))) return;
    try {
      await api.put(`/api/students/${studentId}/verify`, {}, token());
      loadProfile();
    } catch (err) {
      notify.error("Verification failed: " + err.message);
    }
  };

  const openEditExtra = (basic) => {
    setExtraError("");
    setExtraForm({
      dob: basic.dob ? String(basic.dob).slice(0, 10) : "",
      gender: basic.gender || "",
      blood_group: basic.blood_group || "",
      emergency_contact_name: basic.emergency_contact_name || "",
      emergency_contact_phone: basic.emergency_contact_phone || "",
      linkedin_url: basic.linkedin_url || "",
      github_url: basic.github_url || "",
      employment_status: basic.employment_status || "",
      referral_source: basic.referral_source || "",
    });
    setEditingExtra(true);
  };
  const saveExtra = async (e) => {
    e.preventDefault();
    setExtraSaving(true);
    setExtraError("");
    try {
      await api.put(`/api/students/${studentId}`, extraForm, token());
      setEditingExtra(false);
      loadProfile();
    } catch (err) {
      setExtraError(err.message);
    } finally {
      setExtraSaving(false);
    }
  };

  const addEducation = async (e) => {
    e.preventDefault();
    setEduSaving(true);
    setEduError("");
    try {
      const fd = new FormData();
      Object.entries(eduForm).forEach(([k, v]) => fd.append(k, v));
      if (eduFile) fd.append("certificate", eduFile);
      await api.postForm(`/api/students/${studentId}/education`, fd, token());
      setEduForm({ level: "10th", board_university: "", stream: "", degree_name: "", institution: "", year_of_passing: "", percentage_or_cgpa: "" });
      setEduFile(null);
      loadProfile();
    } catch (err) {
      setEduError(err.message);
    } finally {
      setEduSaving(false);
    }
  };
  const removeEducation = async (eduId) => {
    if (!(await notify.confirm("Remove this education record?"))) return;
    try {
      await api.del(`/api/students/${studentId}/education/${eduId}`, token());
      loadProfile();
    } catch (err) {
      notify.error(err.message);
    }
  };

  if (loading) return <div className="p-6">Loading student profile...</div>;
  if (error) return (
    <div className="space-y-3 p-6">
      <Alert type="error">{error}</Alert>
      <div className="flex gap-2">
        <Button onClick={loadProfile}>Retry</Button>
        <Link href="/admin/students"><Button className="bg-gray-600 hover:bg-gray-700">← Back to list</Button></Link>
      </div>
    </div>
  );
  if (!profile) return <Alert type="error">Student not found.</Alert>;

  const { basic, financial, learning, internships, education, warnings } = profile;

  const TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "payments", label: "Payments", icon: Banknote },
    { id: "courses", label: "Enrollments", icon: BookOpen },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "progress", label: "Progress", icon: TrendingUp },
  ];

  return (
    <>
      <PageHeader
        title={basic.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {`Enrollment ID: ${basic.enrollment_id || "—"} | ${basic.college_name || ""}`}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${basic.enrollment_status === "enrolled" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
              {basic.enrollment_status === "enrolled" ? "Enrolled" : "Guest"}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${basic.is_active === 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"}`}>
              {basic.is_active === 0 ? "Inactive" : "Active"}
            </span>
          </span>
        }
        action={
          <div className="flex gap-2">
            <Link href="/admin/students"><Button className="bg-gray-600 hover:bg-gray-700">← Back</Button></Link>
            {basic.status !== "verified" && <Button onClick={verifyStudent}>Verify Student</Button>}
          </div>
        }
      />

      {warnings && warnings.length > 0 && (
        <Alert type="info">
          Some sections couldn&apos;t be loaded ({warnings.join(", ")}) — the rest of this profile is showing normally. Try refreshing, or check the server logs if it persists.
        </Alert>
      )}

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === "profile" && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <DetailItem label="Full Name" value={basic.name} />
              <DetailItem label="Email" value={basic.email} />
              <DetailItem label="Phone" value={basic.phone} />
              <DetailItem label="Status"><StatusBadge status={basic.status} /></DetailItem>
              <DetailItem label="College" value={basic.college_name} />
              <DetailItem label="District" value={basic.district_name} />
              <DetailItem label="Father's Name" value={basic.father_name} />
              <DetailItem label="Parent's Phone" value={basic.parent_phone} />
              <DetailItem label="Aadhaar" value={basic.aadhar} />
              <DetailItem label="PAN" value={basic.pan} />
              <DetailItem label="Roll Number" value={basic.roll_number} />
              <DetailItem label="Registered On" value={basic.created_at ? new Date(basic.created_at).toLocaleDateString() : "—"} />
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <h3 className="text-lg font-semibold">Additional Details</h3>
              {!editingExtra && <button onClick={() => openEditExtra(basic)} className="text-sm font-medium text-brand hover:underline">Edit</button>}
            </div>
            {editingExtra ? (
              <form onSubmit={saveExtra} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {extraError && <div className="md:col-span-3"><Alert type="error">{extraError}</Alert></div>}
                <label className="block text-sm">Date of Birth
                  <input type="date" value={extraForm.dob} onChange={(e) => setExtraForm({ ...extraForm, dob: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">Gender
                  <select value={extraForm.gender} onChange={(e) => setExtraForm({ ...extraForm, gender: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand focus:outline-none">
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block text-sm">Blood Group
                  <input value={extraForm.blood_group} onChange={(e) => setExtraForm({ ...extraForm, blood_group: e.target.value })} placeholder="O+"
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">Emergency Contact Name
                  <input value={extraForm.emergency_contact_name} onChange={(e) => setExtraForm({ ...extraForm, emergency_contact_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">Emergency Contact Phone
                  <input value={extraForm.emergency_contact_phone} onChange={(e) => setExtraForm({ ...extraForm, emergency_contact_phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">Employment Status
                  <input value={extraForm.employment_status} onChange={(e) => setExtraForm({ ...extraForm, employment_status: e.target.value })} placeholder="Student / Employed / Unemployed"
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">LinkedIn URL
                  <input value={extraForm.linkedin_url} onChange={(e) => setExtraForm({ ...extraForm, linkedin_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">GitHub URL
                  <input value={extraForm.github_url} onChange={(e) => setExtraForm({ ...extraForm, github_url: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <label className="block text-sm">Referral Source
                  <input value={extraForm.referral_source} onChange={(e) => setExtraForm({ ...extraForm, referral_source: e.target.value })} placeholder="How did they hear about EduSkill?"
                    className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
                <div className="flex items-end gap-2 md:col-span-3">
                  <button type="button" onClick={() => setEditingExtra(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                  <Button type="submit" loading={extraSaving}>Save</Button>
                </div>
              </form>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <DetailItem label="Date of Birth" value={basic.dob ? new Date(basic.dob).toLocaleDateString() : "—"} />
                <DetailItem label="Gender" value={basic.gender} />
                <DetailItem label="Blood Group" value={basic.blood_group} />
                <DetailItem label="Emergency Contact" value={basic.emergency_contact_name ? `${basic.emergency_contact_name} (${basic.emergency_contact_phone || "—"})` : "—"} />
                <DetailItem label="Employment Status" value={basic.employment_status} />
                <DetailItem label="LinkedIn" value={basic.linkedin_url} />
                <DetailItem label="GitHub" value={basic.github_url} />
                <DetailItem label="Referral Source" value={basic.referral_source} />
              </div>
            )}
          </Card>
        )}

        {activeTab === "education" && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Educational Background</h3>
            {education && education.length > 0 ? (
              <div className="mb-4 space-y-2">
                {education.map((ed) => (
                  <div key={ed.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 p-3">
                    <div className="min-w-[160px] flex-1">
                      <p className="font-medium">{ed.level.toUpperCase()} — {ed.board_university || ed.degree_name || "—"}</p>
                      <p className="text-xs text-gray-500">
                        {[ed.institution, ed.stream, ed.year_of_passing, ed.percentage_or_cgpa].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {ed.certificate_url && (
                      <a href={api.mediaUrl(ed.certificate_url)} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">View certificate</a>
                    )}
                    <button onClick={() => removeEducation(ed.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-gray-500">No education records yet.</p>
            )}

            <form onSubmit={addEducation} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
              {eduError && <div className="w-full"><Alert type="error">{eduError}</Alert></div>}
              <label className="block text-sm">Level
                <select value={eduForm.level} onChange={(e) => setEduForm({ ...eduForm, level: e.target.value })}
                  className="mt-1 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand focus:outline-none">
                  <option value="10th">10th</option>
                  <option value="12th">12th</option>
                  <option value="graduate">Graduate</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block min-w-[160px] flex-1 text-sm">Board / University
                <input value={eduForm.board_university} onChange={(e) => setEduForm({ ...eduForm, board_university: e.target.value })}
                  className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
              </label>
              {eduForm.level === "12th" && (
                <label className="block text-sm">Stream
                  <input value={eduForm.stream} onChange={(e) => setEduForm({ ...eduForm, stream: e.target.value })}
                    className="mt-1 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                </label>
              )}
              {(eduForm.level === "graduate" || eduForm.level === "other") && (
                <>
                  <label className="block min-w-[160px] flex-1 text-sm">Degree
                    <input value={eduForm.degree_name} onChange={(e) => setEduForm({ ...eduForm, degree_name: e.target.value })}
                      className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                  </label>
                  <label className="block min-w-[160px] flex-1 text-sm">Institution
                    <input value={eduForm.institution} onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                      className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
                  </label>
                </>
              )}
              <label className="block w-24 text-sm">Year
                <input type="number" value={eduForm.year_of_passing} onChange={(e) => setEduForm({ ...eduForm, year_of_passing: e.target.value })}
                  className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
              </label>
              <label className="block w-28 text-sm">%/CGPA
                <input value={eduForm.percentage_or_cgpa} onChange={(e) => setEduForm({ ...eduForm, percentage_or_cgpa: e.target.value })}
                  className="mt-1 w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-brand focus:outline-none" />
              </label>
              <label className="block text-sm">Certificate scan
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setEduFile(e.target.files?.[0] || null)}
                  className="mt-1 block text-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-2 file:py-1.5 file:text-white" />
              </label>
              <Button type="submit" loading={eduSaving}>Add</Button>
            </form>
          </Card>
        )}

        {activeTab === "payments" && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Financial History</h3>
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <DetailItem label="Total Paid"><span className="font-bold text-green-600">₹{Number(financial.total_paid || 0).toFixed(2)}</span></DetailItem>
              <DetailItem label="Wallet Balance">₹{Number(financial.wallet_balance || 0).toFixed(2)}</DetailItem>
            </div>
            <TableWrap>
              <thead><tr><Th>Date</Th><Th>Amount</Th><Th>Type</Th><Th>Method</Th><Th>Status</Th></tr></thead>
              <tbody>
                {financial.payments.length > 0 ? financial.payments.map((p) => (
                  <tr key={p.id}>
                    <Td>{new Date(p.created_at).toLocaleDateString()}</Td>
                    <Td>₹{p.amount}</Td>
                    <Td>{p.payment_for_type}</Td>
                    <Td>{p.payment_method}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </tr>
                )) : <tr><Td colSpan="5" className="text-center">No payment history.</Td></tr>}
              </tbody>
            </TableWrap>
          </Card>
        )}

        {activeTab === "courses" && (
          <div className="space-y-6">
            <EnrollmentManager
              title="Courses"
              type="course"
              rows={enroll.courses}
              options={allCourses}
              batches={allBatches.filter((b) => b.course_id)}
              batchKey="course_id"
              newState={newCourse}
              setNewState={setNewCourse}
              onEnroll={doEnroll}
              onUnenroll={unenroll}
            />
            <EnrollmentManager
              title="Programs / Internships"
              type="program"
              rows={enroll.programs}
              options={allPrograms}
              batches={allBatches.filter((b) => b.program_id)}
              batchKey="program_id"
              newState={newProgram}
              setNewState={setNewProgram}
              onEnroll={doEnroll}
              onUnenroll={unenroll}
            />
          </div>
        )}

        {activeTab === "documents" && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Uploaded Documents</h3>
            <TableWrap>
              <thead><tr><Th>Type</Th><Th>Filename</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {learning.documents.length > 0 ? learning.documents.map((d) => (
                  <tr key={d.id}>
                    <Td className="font-medium">{d.document_type}</Td>
                    <Td>{d.file_name}</Td>
                    <Td><StatusBadge status={(d.status || "").replace("pending_", "")} /></Td>
                    <Td><a href={d.file_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">View</a></Td>
                  </tr>
                )) : <tr><Td colSpan="4" className="text-center">No documents uploaded.</Td></tr>}
              </tbody>
            </TableWrap>
          </Card>
        )}

        {activeTab === "progress" && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Progress Rollup</h3>
            {!progressData ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Attendance</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{progressData.attendance.pct != null ? `${progressData.attendance.pct}%` : "—"}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{progressData.attendance.present} of {progressData.attendance.total} sessions</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Assignment Average</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{progressData.assignments.avgPct != null ? `${progressData.assignments.avgPct}%` : "—"}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{progressData.assignments.graded} graded</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Syllabus Self-Confirmation</p>
                  {progressData.syllabus.total === 0 ? (
                    <p className="mt-1 text-sm text-gray-400">No confirmations yet.</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-800">
                      🟢 {progressData.syllabus.got_it} · 🟡 {progressData.syllabus.need_revision} · ⚪ {progressData.syllabus.didnt_attend}
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

// Editable enrollment list for either courses or programs. Lets an admin add,
// change batch/status, and remove enrollments directly (no payment needed).
function EnrollmentManager({ title, type, rows, options, batches, batchKey, newState, setNewState, onEnroll, onUnenroll }) {
  // Which items are not yet enrolled (so we don't offer duplicates).
  const enrolledIds = new Set(rows.map((r) => String(r.item_id)));
  const available = options.filter((o) => !enrolledIds.has(String(o.id)));
  const batchesFor = (itemId) => batches.filter((b) => String(b[batchKey]) === String(itemId));

  return (
    <Card>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>

      {rows.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">Not enrolled in any {title.toLowerCase()} yet.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {rows.map((r) => (
            <div key={r.item_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 p-3">
              <div className="min-w-[160px] flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-gray-500">Enrolled {r.enrolled_at ? new Date(r.enrolled_at).toLocaleDateString() : ""}</p>
              </div>
              <select
                value={r.batch_id || ""}
                onChange={(e) => onEnroll(type, r.item_id, e.target.value, r.status)}
                className="rounded-lg border-2 border-gray-200 px-2 py-1 text-sm focus:border-brand focus:outline-none"
              >
                <option value="">— No batch —</option>
                {batchesFor(r.item_id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select
                value={r.status || "enrolled"}
                onChange={(e) => onEnroll(type, r.item_id, r.batch_id, e.target.value)}
                className="rounded-lg border-2 border-gray-200 px-2 py-1 text-sm focus:border-brand focus:outline-none"
              >
                <option value="enrolled">Enrolled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                {type === "program" && <option value="dropped">Dropped</option>}
              </select>
              <button onClick={() => onUnenroll(type, r.item_id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new enrollment */}
      <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
        <div className="min-w-[200px] flex-1">
          <Select label={`Add ${title.replace(/s$/, "")}`} value={newState.item_id} onChange={(e) => setNewState({ item_id: e.target.value, batch_id: "" })}>
            <option value="">— Select —</option>
            {available.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Select label="Batch (optional)" value={newState.batch_id} onChange={(e) => setNewState({ ...newState, batch_id: e.target.value })}>
            <option value="">— No batch —</option>
            {batchesFor(newState.item_id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        <Button onClick={() => onEnroll(type, newState.item_id, newState.batch_id, "enrolled")}>Enroll</Button>
      </div>
    </Card>
  );
}
