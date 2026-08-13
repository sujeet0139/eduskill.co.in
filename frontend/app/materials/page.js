"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/api/materials")
      .then((d) => setMaterials(d.materials || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = materials.filter((m) =>
    [m.title, m.category, m.description].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="text-center">
        <span className="inline-block rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-900">Resources</span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Study Materials</h1>
        <p className="mt-2 text-gray-500">Download notes, guides and resources shared by your mentors.</p>
      </div>

      <div className="mx-auto mt-8 max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search materials…"
          className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
        />
      </div>

      {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-gray-500">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-gray-500">No study materials available yet. Check back soon.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-md">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-xl">📄</div>
                {m.category && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{m.category}</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900">{m.title}</h3>
              {m.description && <p className="mt-1 flex-1 text-sm text-gray-500">{m.description}</p>}
              {(m.video_url || m.file_path) && (
                <a
                  href={m.video_url || api.mediaUrl(m.file_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-lg bg-blue-900 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                >
                  {m.video_url ? "Watch video →" : "Download / View →"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
