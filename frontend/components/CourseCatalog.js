"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

// Rotating card themes so admin-added courses (which have no color/icon in the
// DB) still render with the same polished look as the static cards.
const THEMES = [
  { icon: "💻", color: "from-blue-900 to-blue-600", btn: "bg-blue-900" },
  { icon: "📱", color: "from-purple-700 to-purple-500", btn: "bg-purple-700" },
  { icon: "🌾", color: "from-green-700 to-green-500", btn: "bg-green-700" },
  { icon: "🎨", color: "from-pink-700 to-pink-500", btn: "bg-pink-700" },
  { icon: "📊", color: "from-teal-700 to-teal-500", btn: "bg-teal-700" },
  { icon: "⚙️", color: "from-amber-700 to-amber-500", btn: "bg-amber-700" },
];

function inr(n) {
  const num = Number(n);
  if (!num) return "Free";
  return "₹" + num.toLocaleString("en-IN");
}

// Map a DB course row to the card shape the design expects.
function fromDb(c, i) {
  const theme = THEMES[i % THEMES.length];
  return {
    key: c.id,
    icon: theme.icon,
    color: theme.color,
    btn: theme.btn,
    title: c.title,
    desc: c.subject || c.category || "Learn in-demand skills",
    weeks: c.duration_weeks ? `${c.duration_weeks} Weeks` : "Self-paced",
    level: c.level || "Beginner",
    language: c.language || "Hindi + English",
    price: inr(c.price),
    original: null,
    includes: (c.description || "")
      .split(/[\n•.]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4),
  };
}

export default function CourseCatalog({ fallback = [] }) {
  const [courses, setCourses] = useState(fallback.map((c, i) => ({ ...c, key: c.title, level: "Beginner", language: "Hindi + English" })));

  useEffect(() => {
    api
      .get("/api/public/courses")
      .then((d) => {
        if (d.courses && d.courses.length) setCourses(d.courses.map(fromDb));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {courses.map((c) => (
        <div key={c.key} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition hover:-translate-y-1">
          <div className={`bg-gradient-to-br ${c.color} text-white p-6`}>
            <div className="text-4xl mb-3">{c.icon}</div>
            <h3 className="text-xl font-bold mb-1">{c.title}</h3>
            <p className="text-sm opacity-80">{c.desc}</p>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">{c.weeks}</span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">{c.level}</span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">{c.language}</span>
            </div>
            <div className="text-2xl font-bold text-blue-900 mb-4">
              {c.price} {c.original && <span className="text-sm text-gray-400 line-through font-normal">{c.original}</span>}
            </div>
            {c.includes && c.includes.length > 0 && (
              <ul className="mb-5 space-y-1.5">
                {c.includes.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="text-green-500 font-bold text-xs">✓</span>{item}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/register">
              <button className={`w-full ${c.btn} text-white py-3 rounded-lg font-semibold text-sm hover:opacity-90`}>
                Enroll Now
              </button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
