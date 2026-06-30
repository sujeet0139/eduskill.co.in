"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminAuth } from "@/lib/auth";
import { api } from "@/lib/api";

// Sidebar grouped by area.
const NAV_GROUPS = [
  {
    title: null,
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    title: "People",
    items: [
      { href: "/admin/students", label: "Students" },
      { href: "/admin/teachers", label: "Teachers" },
      { href: "/admin/faculty", label: "Faculty" },
      { href: "/admin/admins", label: "Admin Users" },
    ],
  },
  {
    title: "Academics",
    items: [
      { href: "/admin/courses", label: "Courses" },
      { href: "/admin/programs", label: "Programs" },
      { href: "/admin/materials", label: "Study Materials" },
      { href: "/admin/live-classes", label: "Live Classes" },
      { href: "/admin/exams", label: "Exams" },
      { href: "/admin/certificates", label: "Certificates" },
    ],
  },
  {
    title: "Masters",
    items: [
      { href: "/admin/colleges", label: "Colleges" },
      { href: "/admin/districts", label: "Cities / Districts" },
      { href: "/admin/departments", label: "Departments" },
    ],
  },
  {
    title: "Site & Content",
    items: [
      { href: "/admin/hero-slides", label: "Hero Banner" },
      { href: "/admin/announcements", label: "Announcements" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/settings/registration", label: "Form Builder" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

// Flat list for the mobile top-bar.
const NAV = NAV_GROUPS.flatMap((g) => g.items);

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(null);

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (!adminAuth.token()) {
      router.replace("/admin/login");
      return;
    }
    setAdmin(adminAuth.info());
    setReady(true);
  }, [isLogin, router, pathname]);

  if (isLogin) return children;
  if (!ready) return null;

  const logout = async () => {
    try { await api.post("/api/auth/logout"); } catch {}
    adminAuth.logout();
    router.push("/admin/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="hidden w-56 shrink-0 flex-col bg-gray-900 text-gray-200 md:flex">
        <div className="border-b border-gray-700 px-5 py-4 text-lg font-bold text-white">
          eduskill <span className="text-brand">admin</span>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title || `g${gi}`} className="space-y-1">
              {group.title && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      active ? "bg-brand text-white" : "hover:bg-gray-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <button onClick={logout} className="border-t border-gray-700 px-5 py-3 text-left text-sm hover:bg-gray-800">
          Logout
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div className="flex gap-3 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap text-xs text-gray-600">
                {item.label}
              </Link>
            ))}
          </div>
          <span className="ml-auto text-sm text-gray-500">{admin?.email}</span>
        </header>
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
