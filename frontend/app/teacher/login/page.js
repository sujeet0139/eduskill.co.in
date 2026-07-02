"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { teacherAuth } from "@/lib/auth";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/teacher/login", form);
      teacherAuth.login(res.token, res.teacher);
      router.push("/teacher");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Portal</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to share assignments and grade your students.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-600 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
            <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-600 focus:outline-none" />
          </label>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-800 disabled:bg-gray-400">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">No password? Ask your admin to set one for you.</p>
      </div>
    </main>
  );
}
