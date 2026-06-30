"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Thin moving bar at the very top showing REAL data: live counts + latest
// announcements. Hidden if there's nothing meaningful to show.
export default function TopTicker() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let parts = [];
    Promise.allSettled([
      api.get("/api/public/stats"),
      api.get("/api/public/announcements"),
    ]).then(([statsR, annR]) => {
      const s = statsR.status === "fulfilled" ? statsR.value.stats : null;
      if (s) {
        if (s.students) parts.push(`🎓 ${s.students}+ students registered`);
        if (s.colleges) parts.push(`🏫 ${s.colleges} partner colleges`);
        if (s.courses) parts.push(`📚 ${s.courses} live courses`);
        if (s.certificates) parts.push(`🏆 ${s.certificates} certificates issued`);
      }
      const anns = annR.status === "fulfilled" ? (annR.value.announcements || []) : [];
      anns.forEach((a) => parts.push(`📢 ${a.title}`));
      if (parts.length === 0) {
        parts = ["🚀 Admissions open — register today and start your internship journey!"];
      }
      setItems(parts);
    });
  }, []);

  if (items.length === 0) return null;
  const line = items.join("     •     ");

  return (
    <div className="marquee-wrap overflow-hidden bg-blue-950 py-1.5 text-xs text-blue-100">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        <span className="px-4">{line}</span>
        <span className="px-4" aria-hidden="true">{line}</span>
      </div>
    </div>
  );
}
