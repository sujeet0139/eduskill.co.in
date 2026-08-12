"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { Alert, Button, Card, Input } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/admin/login", form);
      adminAuth.login(res.token, res.admin);
      router.push("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to manage eduskill.co.in</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <Button type="submit" loading={loading} className="w-full">Sign In</Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/admin/forgot-password" className="font-medium text-brand hover:underline">Forgot password?</Link>
        </p>
      </Card>
    </div>
  );
}
