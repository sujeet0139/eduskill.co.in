"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { studentAuth } from "@/lib/auth";
import { Alert, Button, Card, Input } from "@/components/ui";

export default function StudentLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", form);
      studentAuth.login(res.token, res.student);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <Card>
          <h1 className="text-2xl font-bold text-gray-900">Student Login</h1>
          <p className="mt-1 text-sm text-gray-500">
            Use your email and the <strong>reference number</strong> you received at registration.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <Alert type="error">{error}</Alert>}
            <Input label="Email" type="email" name="email" value={form.email} onChange={change} required />
            <Input label="Reference Number" name="password" value={form.password} onChange={change} placeholder="SKC…" required />
            <Button type="submit" loading={loading} className="w-full">Login</Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            New here?{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">Register</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
