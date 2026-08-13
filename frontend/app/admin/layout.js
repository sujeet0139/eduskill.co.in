"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ToastProvider } from "@/components/Toast";
import {
  LayoutDashboard, Users, GraduationCap, UserCog, BookOpen, Layers, CalendarClock,
  FileText, ClipboardList, Award, School, MapPin, Building2, ImageIcon, Megaphone,
  MessageSquare, Wallet, SlidersHorizontal, Settings, Plus, Bell, Search, Menu, X, LogOut,
  Link2, ListChecks,
} from "lucide-react";

const NAV_GROUPS = [
  { title: null, items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "People",
    items: [
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
      { href: "/admin/faculty", label: "Faculty", icon: UserCog },
      { href: "/admin/admins", label: "Admin Users", icon: UserCog },
    ],
  },
  {
    title: "Academics",
    items: [
      { href: "/admin/courses", label: "Courses", icon: BookOpen },
      { href: "/admin/programs", label: "Programs", icon: Layers },
      { href: "/admin/batches", label: "Batches", icon: Layers },
      { href: "/admin/mapping", label: "Course Mapping", icon: Link2 },
      { href: "/admin/materials", label: "Study Materials", icon: FileText },
      { href: "/admin/assignments", label: "Assignments", icon: ClipboardList },
      { href: "/admin/live-classes", label: "Live Classes", icon: CalendarClock },
      { href: "/admin/syllabus", label: "Syllabus", icon: ListChecks },
      { href: "/admin/exams", label: "Exams", icon: FileText },
      { href: "/admin/certificates", label: "Certificates", icon: Award },
    ],
  },
  {
    title: "Masters",
    items: [
      { href: "/admin/universities", label: "Universities", icon: School },
      { href: "/admin/colleges", label: "Colleges", icon: School },
      { href: "/admin/districts", label: "Cities / Districts", icon: MapPin },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
    ],
  },
  {
    title: "Site & Content",
    items: [
      { href: "/admin/hero-slides", label: "Hero Banner", icon: ImageIcon },
      { href: "/admin/campaigns", label: "Campaign Links", icon: Link2 },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/communications", label: "Communications", icon: MessageSquare },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/payments", label: "Finance", icon: Wallet },
      { href: "/admin/settings/registration", label: "Form Builder", icon: SlidersHorizontal },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const CREATE_LINKS = [
  { href: "/admin/students", label: "New Student" },
  { href: "/admin/courses", label: "New Course" },
  { href: "/admin/live-classes", label: "New Live Class" },
  { href: "/admin/assignments", label: "New Assignment" },
];

function NavList({ pathname, onNavigate }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.title || `g${gi}`} className="space-y-0.5">
          {group.title && (
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={17} className={active ? "text-white" : "text-gray-400"} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(0);

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) { setReady(true); return; }
    if (!adminAuth.token()) { router.replace("/admin/login"); return; }
    setAdmin(adminAuth.info());
    setReady(true);
    api.get("/api/payments/finance-summary", adminAuth.token())
      .then((d) => setPending(d.data?.totals?.pending_count || 0)).catch(() => {});
  }, [isLogin, router, pathname]);

  useEffect(() => { setDrawer(false); setCreateOpen(false); }, [pathname]);

  if (isLogin) return children;
  if (!ready) return null;

  const logout = async () => {
    try { await api.post("/api/auth/logout"); } catch {}
    adminAuth.logout();
    router.push("/admin/login");
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-50">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
          <Link href="/admin" className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <span className="text-lg font-extrabold text-gray-900">eduskill</span>
            <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-white">admin</span>
          </Link>
          <NavList pathname={pathname} />
        </aside>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <span className="text-lg font-extrabold text-gray-900">eduskill <span className="text-brand">admin</span></span>
                <button onClick={() => setDrawer(false)}><X size={20} className="text-gray-500" /></button>
              </div>
              <NavList pathname={pathname} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-2.5 backdrop-blur">
            <button className="md:hidden" onClick={() => setDrawer(true)}><Menu size={22} className="text-gray-600" /></button>

            <GlobalSearch />

            <div className="ml-auto flex items-center gap-2">
              {/* + Create */}
              <div className="relative">
                <button onClick={() => setCreateOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
                  <Plus size={16} /> <span className="hidden sm:inline">Create</span>
                </button>
                {createOpen && (
                  <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                    {CREATE_LINKS.map((c) => (
                      <Link key={c.href} href={c.href} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{c.label}</Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending approvals bell */}
              <Link href="/admin/payments" className="relative rounded-lg p-2 hover:bg-gray-100" title="Pending approvals">
                <Bell size={18} className="text-gray-600" />
                {pending > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{pending}</span>
                )}
              </Link>

              {/* Profile */}
              <div className="hidden items-center gap-2 border-l border-gray-200 pl-3 sm:flex">
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-800">{admin?.name || "Admin"}</div>
                  <div className="text-[11px] text-gray-400">{admin?.email}</div>
                </div>
                <button onClick={logout} title="Logout" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"><LogOut size={18} /></button>
              </div>
              <button onClick={logout} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:hidden"><LogOut size={18} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

// Global search: jump to a nav page or a student. Students are lazy-loaded on
// first focus so the layout stays light.
function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const focus = () => {
    setOpen(true);
    if (!loaded) {
      setLoaded(true);
      api.get("/api/students", adminAuth.token()).then((d) => setStudents(d.students || [])).catch(() => {});
    }
  };

  const ql = q.toLowerCase();
  const pageHits = q ? ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(ql)).slice(0, 5) : [];
  const studentHits = q ? students.filter((s) => [s.name, s.email, s.reference_no].join(" ").toLowerCase().includes(ql)).slice(0, 6) : [];

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
        <Search size={16} className="text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={focus}
          placeholder="Search pages or students…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      {open && q && (
        <div className="absolute left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {pageHits.length === 0 && studentHits.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No matches.</p>}
          {pageHits.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase text-gray-400">Pages</p>
              {pageHits.map((i) => (
                <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{i.label}</Link>
              ))}
            </>
          )}
          {studentHits.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase text-gray-400">Students</p>
              {studentHits.map((s) => (
                <Link key={s.id} href={`/admin/students/${s.id}`} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50">
                  {s.name} <span className="text-xs text-gray-400">· {s.reference_no}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
