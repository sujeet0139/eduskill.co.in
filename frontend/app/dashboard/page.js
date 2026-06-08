"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { studentAuth } from "@/lib/auth";
import { Alert, Button, Card, Input, StatusBadge } from "@/components/ui";

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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const s = studentAuth.student();
    if (!s) {
      router.replace("/login");
      return;
    }
    setStudent(s);
    api.get(`/api/payments/status/${s.id}`).then(setPayment).catch(() => {});
    api.get("/api/materials").then((d) => setMaterials(d.materials || [])).catch(() => {});
    api.get("/api/courses").then((d) => setCourses(d.courses || [])).catch(() => {});
  }, [router]);

  const logout = () => {
    studentAuth.logout();
    router.push("/");
  };

  const uploadPayment = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (!pay.file) {
      setMsg({ type: "error", text: "Please choose a screenshot to upload." });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("studentId", student.id);
      fd.append("transactionId", pay.transactionId);
      fd.append("amount", pay.amount);
      fd.append("screenshot", pay.file);
      await api.postForm("/api/payments/upload", fd);
      setMsg({ type: "success", text: "Payment screenshot uploaded. Awaiting verification." });
      const updated = await api.get(`/api/payments/status/${student.id}`);
      setPayment(updated);
      setPay({ transactionId: "", amount: "1000", file: null });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (!student) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {student.name}</h1>
            <p className="text-sm text-gray-500">Ref: {student.reference_no} · {student.email}</p>
          </div>
          <button onClick={logout} className="text-sm font-medium text-gray-500 hover:text-red-600">
            Logout
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Admission Status</h2>
            <div className="flex items-center gap-3">
              <StatusBadge status={student.status} />
              <span className="text-sm text-gray-500">
                {student.status === "verified" ? "Your admission is confirmed." : "Complete payment to get verified."}
              </span>
            </div>
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700">Payment</h3>
              {payment && payment.status && payment.status !== "none" ? (
                <p className="mt-1 text-sm">
                  Latest payment: <StatusBadge status={payment.status} />{" "}
                  {payment.amount ? `· ₹${payment.amount}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">No payment recorded yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Upload Payment Screenshot</h2>
            {msg.text && <div className="mb-3"><Alert type={msg.type}>{msg.text}</Alert></div>}
            <form onSubmit={uploadPayment} className="space-y-3">
              <Input
                label="Transaction ID"
                value={pay.transactionId}
                onChange={(e) => setPay({ ...pay, transactionId: e.target.value })}
              />
              <Input
                label="Amount (₹)"
                type="number"
                value={pay.amount}
                onChange={(e) => setPay({ ...pay, amount: e.target.value })}
              />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Screenshot (JPG/PNG/PDF)</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setPay({ ...pay, file: e.target.files[0] })}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white"
                />
              </label>
              <Button type="submit" loading={uploading} className="w-full">Submit Payment</Button>
            </form>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Study Materials</h2>
            {materials.length === 0 ? (
              <p className="text-sm text-gray-500">No materials published yet.</p>
            ) : (
              <ul className="space-y-2">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm font-medium">{m.title}</span>
                    <a href={fileHref(m.file_path)} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Available Courses</h2>
            {courses.length === 0 ? (
              <p className="text-sm text-gray-500">No courses available yet.</p>
            ) : (
              <ul className="space-y-2">
                {courses.map((c) => (
                  <li key={c.id} className="rounded-lg border px-3 py-2">
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-gray-500">{c.category} · {c.price ? `₹${c.price}` : "Free"}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
