"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { studentAuth } from "@/lib/auth";

export default function Navbar() {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    setStudent(studentAuth.student());
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-extrabold text-brand">
          eduskill<span className="text-gray-900">.co.in</span>
        </Link>
        <div className="flex items-center gap-2 text-sm font-medium sm:gap-4">
          <Link href="/" className="hidden text-gray-600 hover:text-brand sm:inline">
            Home
          </Link>
          <Link href="/materials" className="hidden text-gray-600 hover:text-brand sm:inline">
            Materials
          </Link>
          <Link href="/register" className="text-gray-600 hover:text-brand">
            Register
          </Link>
          {student ? (
            <Link href="/dashboard" className="rounded-lg bg-brand px-3 py-1.5 text-white hover:bg-brand-dark">
              My Dashboard
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-brand px-3 py-1.5 text-white hover:bg-brand-dark">
              Student Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
