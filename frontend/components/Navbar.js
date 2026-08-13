"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { studentAuth } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#courses", label: "Programs & Courses" },
  { href: "/materials", label: "Study Material" },
  { href: "/tools", label: "Visibility Tools" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [student, setStudent] = useState(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setStudent(studentAuth.student()); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="EduSkill home">
          <span className="flex h-9 w-9 items-start justify-center overflow-hidden rounded-full bg-white ring-1 ring-blue-100">
            <Image src="/eduskill-logo.png" alt="" width={72} height={72} className="max-w-none -translate-y-1.5" priority />
          </span>
          <span className="text-xl font-extrabold text-brand">edu<span className="text-orange-500">Skill</span><span className="text-gray-900">.co.in</span></span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-brand">
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          {student ? (
            <Link href="/dashboard" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              My Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-brand">Login</Link>
              <Link href="/register" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
        >
          <div className="space-y-1.5">
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </div>
        </button>
      </nav>

      {/* Mobile menu panel */}
      {open && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-gray-100 pt-3">
              {student ? (
                <Link href="/dashboard" className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white">
                  My Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700">
                    Login
                  </Link>
                  <Link href="/register" className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
