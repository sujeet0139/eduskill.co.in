"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminAuth } from "@/lib/auth";

// Only routes that have pages today. More (colleges, materials, certificates,
// announcements, admins, settings) to be added later.
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/programs", label: "Programs" },
];

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

  const logout = () => {
    adminAuth.logout();
    router.push("/admin/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="hidden w-56 shrink-0 flex-col bg-gray-900 text-gray-200 md:flex">
        <div className="border-b border-gray-700 px-5 py-4 text-lg font-bold text-white">
          eduskill <span className="text-brand">admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
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
