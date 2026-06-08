"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { COLLEGES, DEPARTMENTS } from "@/lib/colleges";
import { Alert, Button, Card, Input, Select } from "@/components/ui";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", collegeId: "", department: "", aadhar: "", pan: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/students/register", form);
      setSuccess(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Navbar />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
          <Card>
            <h1 className="text-2xl font-bold text-green-700">Registration Successful 🎉</h1>
            <p className="mt-2 text-gray-600">
              Save your reference number — you'll use it with your email to log in.
            </p>
            <div className="my-4 rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-sm text-gray-500">Your Reference Number</p>
              <p className="text-2xl font-extrabold tracking-wide text-brand">{success.referenceNo}</p>
            </div>
            <div className="flex gap-3">
              <Link href="/login" className="flex-1">
                <Button className="w-full">Go to Login</Button>
              </Link>
            </div>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <Card>
          <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
          <p className="mt-1 text-sm text-gray-500">Fill in your details to get started.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <Alert type="error">{error}</Alert>}
            <Input label="Full Name *" name="name" value={form.name} onChange={change} required />
            <Input label="Email *" type="email" name="email" value={form.email} onChange={change} required />
            <Input label="Phone (10 digits) *" name="phone" value={form.phone} onChange={change} required />
            <Select label="College *" name="collegeId" value={form.collegeId} onChange={change} required>
              <option value="">Select your college</option>
              {COLLEGES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select label="Department" name="department" value={form.department} onChange={change}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Aadhar (optional)" name="aadhar" value={form.aadhar} onChange={change} />
              <Input label="PAN (optional)" name="pan" value={form.pan} onChange={change} />
            </div>
            <Button type="submit" loading={loading} className="w-full">Register Now</Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">Login here</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
