"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Real homepage stats pulled from /api/public/stats, with sensible fallbacks
// so the strip never looks empty before data loads.
export default function LiveStats() {
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get("/api/public/stats").then((d) => setS(d.stats)).catch(() => {});
  }, []);

  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k+` : `${n}`);

  const cells = [
    [s ? fmt(s.students) : "—", "Students Registered"],
    [s ? s.colleges : "—", "Partner Colleges"],
    [s ? s.courses + s.programs : "—", "Programs & Courses"],
    [s ? fmt(s.certificates) : "—", "Certificates Issued"],
  ];

  return (
    <div className="flex flex-wrap justify-center gap-8">
      {cells.map(([num, label], i) => (
        <div key={label} className="animate-fadeUp text-center" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="text-3xl font-bold">{num}</div>
          <div className="mt-1 text-xs text-blue-300">{label}</div>
        </div>
      ))}
    </div>
  );
}
