"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TopTicker from "@/components/TopTicker";

// The public marketing chrome (ticker + navbar + footer) should NOT appear on
// the admin panel — the admin has its own layout/sidebar. Hidden on /admin/*.
function isAdmin(pathname) {
  return pathname === "/admin" || (pathname || "").startsWith("/admin/");
}

export function SiteHeader() {
  const pathname = usePathname();
  if (isAdmin(pathname)) return null;
  return (
    <>
      <TopTicker />
      <Navbar />
    </>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (isAdmin(pathname)) return null;
  return <Footer />;
}
