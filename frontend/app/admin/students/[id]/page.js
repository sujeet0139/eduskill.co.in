"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Button, Card, StatusBadge, Alert } from "@/components/ui";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";
import { User, Banknote, BookOpen, FileText } from "lucide-react";

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

  const token = () => adminAuth.token();

  const loadProfile = () => {
    if (!studentId) return;
    setLoading(true);
    api.get(`/api/students/${studentId}/full-profile`, token())
      .then((res) => setProfile(res.profile))
      .catch((err) => setError("Failed to load student profile: " + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadProfile, [studentId]);

  const verifyStudent = async () => {
    if (!confirm("Mark this student as verified?")) return;
    try {
      await api.put(`/api/students/${studentId}/verify`, {}, token());
      loadProfile();
    } catch (err) {
      alert("Verification failed: " + err.message);
    }
  };

  if (loading) return <div className="p-6">Loading student profile...</div>;
  if (error) return <Alert type="error">{error}</Alert>;
  if (!profile) return <Alert type="error">Student not found.</Alert>;

  const { basic, financial, learning, internships } = profile;

  const TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "payments", label: "Payments", icon: Banknote },
    { id: "courses", label: "Courses", icon: BookOpen },
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
          <Card>
            <h3 className="mb-4 text-lg font-semibold">Learning & Internships</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-semibold text-gray-700">Enrolled Courses</h4>
                {learning.courses.length > 0 ? learning.courses.map((c) => (
                  <div key={c.id} className="mb-2 border-b pb-2"><p className="font-medium">{c.title}</p><p className="text-xs text-gray-500">Status: {c.status}</p></div>
                )) : <p className="text-sm text-gray-500">No courses enrolled.</p>}
              </div>
              <div>
                <h4 className="mb-2 font-semibold text-gray-700">Internship Programs</h4>
                {internships.length > 0 ? internships.map((p) => (
                  <div key={p.id} className="mb-2 border-b pb-2"><p className="font-medium">{p.program_title}</p><p className="text-xs text-gray-500">Status: {p.status}</p></div>
                )) : <p className="text-sm text-gray-500">No internships enrolled.</p>}
              </div>
            </div>
          </Card>
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
