"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { studentAuth } from "@/lib/auth";
import { Alert, Button, Card, Input, StatusBadge } from "@/components/ui";
import { FileDown, BookOpen, GraduationCap, CreditCard, LogOut, CheckCircle, XCircle } from "lucide-react";

function fileHref(path) {
  if (!path) return "#";
  return /^https?:\/\//.test(path) ? path : `${api.base}${path}`;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [payment, setPayment] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [pay, setPay] = useState({ transactionId: "", amount: "1000", file: null });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [paymentMsg, setPaymentMsg] = useState({ type: "", text: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const s = studentAuth.student();
    if (!s) {
      router.replace("/login");
      return;
    }
    setStudent(s);
    // Fetch all data in parallel for faster loading
    Promise.all([
      api.get(`/api/student-dashboard/profile`, studentAuth.token()), // Correct endpoint to get student status
      api.get("/api/materials"),
      api.get("/api/courses"),
    ]).then(([profileData, materialsData, coursesData]) => {
      // The student status is on the profile object, not a separate payment status call
      setStudent(profileData.profile); // Update student with latest data from API
      setMaterials(materialsData.materials || []);
      setCourses(coursesData.courses || []);
    }).catch(err => setMsg({ type: "error", text: "Failed to load dashboard data. " + err.message }));
  }, [router]);

  const logout = async () => {
    try { await api.post("/api/auth/logout"); } catch {}
    studentAuth.logout();
    router.push("/");
  };

  const uploadPayment = async (e) => {
    e.preventDefault();
    setPaymentMsg({ type: "", text: "" });
    if (!pay.file) {
      setPaymentMsg({ type: "error", text: "Please choose a screenshot to upload." });
      return;
    }
    setUploading(true);
    try {
      // Step 1: Initiate a payment record to get a payment ID.
      // We'll mark this as a 'registration' payment for now.
      const initRes = await api.post("/api/payments/initiate", {
        student_id: student.id,
        item_type: 'registration', // This is a general admission payment
        amount: pay.amount,
      });

      if (!initRes.payment_id) {
        throw new Error("Failed to create a payment record.");
      }

      // Step 2: Upload the screenshot against the new payment ID.
      const fd = new FormData();
      fd.append("transactionId", pay.transactionId);
      fd.append("screenshot", pay.file);
      await api.postForm(`/api/payments/${initRes.payment_id}/upload-proof`, fd);

      setPaymentMsg({ type: "success", text: "Payment screenshot uploaded. Awaiting verification." });
      // Refresh the entire student profile to get the latest payment and admission status.
      // This also helps update the payment status card.
      api.get(`/api/student-dashboard/profile`, studentAuth.token()).then(profileData => {
        setStudent(profileData.profile);
      });
      setPay({ transactionId: "", amount: "1000", file: null });
    } catch (err) {
      setPaymentMsg({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (!student) return null;

  return (
    <>
      {/* The <Navbar /> is removed from here and now only exists in the root layout */}
      <main className="min-h-screen bg-gray-50/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
          {/* -- HEADER -- */}
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome, {student.name}</h1>
              <p className="mt-1 text-sm text-gray-500">Ref: {student.reference_no} · {student.email}</p>
            </div>
            <button onClick={logout} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-500 shadow-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-red-600">
              <LogOut size={16} /> Logout
            </button>
          </div>

          {msg.text && <div className="mb-6"><Alert type={msg.type}>{msg.text}</Alert></div>}

          {/* -- OVERVIEW STATS -- */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-blue-100 p-3 text-blue-600"><GraduationCap size={24} /></div>
              <div>
                <p className="text-xs text-gray-500">Admission Status</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={student.status} />
                  <p className="text-sm font-semibold capitalize">{student.status}</p>
                </div>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-green-100 p-3 text-green-600"><BookOpen size={24} /></div>
              <div>
                <p className="text-xs text-gray-500">Courses Enrolled</p>
                <p className="text-lg font-bold">0</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-yellow-100 p-3 text-yellow-600"><CreditCard size={24} /></div>
              <div>
                <p className="text-xs text-gray-500">Payment Status</p>
                {payment && payment.status && payment.status !== "none" ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={payment.status} />
                    <p className="text-sm font-semibold capitalize">{payment.status}</p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-500">No payment recorded</p>
                )}
              </div>
            </Card>
          </div>

          {/* -- PENDING PAYMENT SECTION (Conditional) -- */}
          {student.status !== "verified" && (
            <Card className="mb-8 border-2 border-orange-400 bg-orange-50/50">
              <div className="flex flex-col items-center gap-6 p-6 md:flex-row">
                <div className="flex-1">
                  <h2 className="mb-2 text-xl font-bold text-gray-900">Complete Your Admission</h2>
                  <p className="mb-4 text-sm text-gray-600">
                    Your admission is not yet verified. Please complete the payment process by uploading a screenshot of your payment transaction.
                  </p>
                  {paymentMsg.text && <div className="mb-4"><Alert type={paymentMsg.type}>{paymentMsg.text}</Alert></div>}
                  <form onSubmit={uploadPayment} className="space-y-4 rounded-lg bg-white p-4 ring-1 ring-gray-200">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <input name="transactionId" placeholder="Transaction ID" value={pay.transactionId} onChange={(e) => setPay({ ...pay, transactionId: e.target.value })} className="w-full rounded-lg border-gray-200 px-3 py-2 text-sm" />
                      <input name="amount" type="number" placeholder="Amount (₹)" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="w-full rounded-lg border-gray-200 px-3 py-2 text-sm" />
                    </div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setPay({ ...pay, file: e.target.files[0] })}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand hover:file:bg-brand/20"
                    />
                    <Button type="submit" loading={uploading} className="w-full">Submit for Verification</Button>
                  </form>
                </div>
                <div className="w-full max-w-xs rounded-lg bg-white p-4 text-center ring-1 ring-gray-200">
                  <h3 className="mb-2 font-semibold text-gray-800">Payment Details</h3>
                  <img src="/qr-code.png" alt="QR Code for payment" className="mx-auto mb-2 w-32 h-32" />
                  <p className="text-sm font-medium">UPI ID: <span className="font-mono text-brand">eduskill@upi</span></p>
                  <p className="text-xs text-gray-500">Scan to pay or use the UPI ID</p>
                </div>
              </div>
            </Card>
          )}

          {/* -- MAIN CONTENT GRID -- */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column */}
            <div className="space-y-8 lg:col-span-2">
              <Card>
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Study Materials</h2>
                {materials.length === 0 ? (
                  <p className="text-sm text-gray-500">No materials published yet. Check back soon!</p>
                ) : (
                  <ul className="space-y-3">
                    {materials.map((m) => (
                      <li key={m.id} className="flex items-center justify-between rounded-lg border bg-gray-50/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <FileDown className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-800">{m.title}</span>
                        </div>
                        <a href={fileHref(m.file_path)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand hover:underline">
                          Download
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-8 lg:col-span-1">
              <Card>
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Available Courses</h2>
                {courses.length === 0 ? (
                  <p className="text-sm text-gray-500">No courses available at the moment.</p>
                ) : (
                  <ul className="space-y-3">
                    {courses.map((c) => (
                      <li key={c.id} className="rounded-lg border p-3">
                        <p className="font-semibold text-gray-800">{c.title}</p>
                        <p className="text-xs text-gray-500">{c.category} · <span className="font-bold text-green-600">{c.price ? `₹${c.price}` : "Free"}</span></p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
