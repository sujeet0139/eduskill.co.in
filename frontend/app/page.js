"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";

export default function Home() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/api/courses").then((d) => setCourses(d.courses || [])).catch(() => {});
  }, []);

  return (
    <>
      <Navbar />

      <section className="bg-gradient-to-br from-brand to-brand-dark text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            Build skills. Get certified.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
            eduskill.co.in helps students across Bihar register for industry-ready
            programs, access study material and earn recognised certificates.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/register" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand hover:bg-blue-50">
              Register Now
            </Link>
            <Link href="/login" className="rounded-lg border border-white/70 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Student Login
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Featured Courses</h2>
        {courses.length === 0 ? (
          <p className="text-gray-500">Courses will appear here soon. Check back shortly!</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id}>
                <h3 className="text-lg font-semibold text-gray-900">{c.title}</h3>
                <p className="mt-1 text-sm text-brand">{c.category}</p>
                <p className="mt-2 line-clamp-3 text-sm text-gray-600">{c.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{c.duration_weeks ? `${c.duration_weeks} weeks` : ""}</span>
                  <span className="font-semibold text-gray-900">{c.price ? `₹${c.price}` : "Free"}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-gray-500 sm:flex-row">
          <span>© {new Date().getFullYear()} eduskill.co.in. All rights reserved.</span>
          <Link href="/admin/login" className="hover:text-brand">
            Admin
          </Link>
        </div>
      </footer>
    </>
  );
}
