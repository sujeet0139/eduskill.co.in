"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Card, StatusBadge, Alert, Select } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { User, Banknote, BookOpen, FileText } from "lucide-react";
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

  const { basic, financial, learning, internships, warnings } = profile;

  const TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "payments", label: "Payments", icon: Banknote },
    { id: "courses", label: "Enrollments", icon: BookOpen },
    { id: "documents", label: "Documents", icon: FileText },
  ];

  return (
    <>
      <PageHeader
        title={basic.name}
        subtitle={`Enrollment ID: ${basic.enrollment_id || "—"} | ${basic.college_name || ""}`}
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
