"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Renders the LNMU-affiliated colleges grid. Fetches the admin-managed list
// from the API and falls back to the static list if the API is unavailable.
export default function EligibleColleges({ fallback = [] }) {
  const [colleges, setColleges] = useState(fallback);

  useEffect(() => {
    api
      .get("/api/public/colleges")
      .then((d) => {
        if (d.colleges && d.colleges.length) setColleges(d.colleges);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {colleges.map((c) => (
        <div key={c.id || c.name} className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
          <div className="font-semibold text-white text-sm mb-1">{c.name}</div>
          <div className="text-gray-400 text-xs">{c.district ? `${c.district}, Bihar` : "Bihar"}</div>
        </div>
      ))}
    </div>
  );
}
