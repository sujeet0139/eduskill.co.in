"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Alert, Button, Card } from "@/components/ui";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/admin/reset-password", { token, password });
      setMsg(res.message || "Password reset. Redirecting to login…");
      setTimeout(() => router.push("/admin/login"), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Alert type="error">
        Invalid reset link. Please request a new one from{" "}
        <Link href="/admin/forgot-password" className="font-medium underline">Forgot Password</Link>.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      {msg && <Alert type="success">{msg}</Alert>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">New password</span>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Confirm password</span>
        <input
          type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <Button type="submit" loading={loading} className="w-full">Reset password</Button>
    </form>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a new password for your admin account.</p>
        <Suspense fallback={<p className="mt-6 text-sm text-gray-500">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </Card>
    </div>
  );
}
