"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Alert, Button, Card, Input } from "@/components/ui";

// Staff/admin self-service forgot-password (dev-prompt item #30) -- mirrors
// the student flow at /forgot-password, targeting admin_users instead.
export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/admin/forgot-password", { email });
      setMsg(res.message || "If that email is registered, a reset link has been sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
        <p className="mt-1 text-sm text-gray-500">Enter your admin email and we&apos;ll send a reset link.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {msg && <Alert type="success">{msg}</Alert>}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/admin/login" className="font-medium text-brand hover:underline">Back to login</Link>
        </p>
      </Card>
    </div>
  );
}
