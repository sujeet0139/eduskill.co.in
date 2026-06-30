"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

// Admin-managed homepage banner. Pulls active slides from /api/public/hero-slides
// (managed in Admin → Site & Content → Hero Banner). Renders nothing if there are
// no slides, so the static hero below remains the default.
export default function HeroBanner() {
  const [slides, setSlides] = useState([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    api.get("/api/public/hero-slides").then((d) => setSlides(d.slides || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const s = slides[i];

  return (
    <section className="relative h-56 w-full overflow-hidden bg-blue-950 sm:h-80 md:h-96">
      {s.image_url && (
        <img src={s.image_url} alt={s.alt_text || s.title || "banner"} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {(s.title || s.subtitle || s.cta_text) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 px-4 text-center text-white">
          {s.title && <h2 className="text-2xl font-bold drop-shadow md:text-4xl">{s.title}</h2>}
          {s.subtitle && <p className="mt-2 max-w-2xl text-sm text-gray-100 drop-shadow md:text-lg">{s.subtitle}</p>}
          {s.cta_text && s.cta_link && (
            <Link href={s.cta_link} className="mt-5 rounded-lg bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-600">
              {s.cta_text}
            </Link>
          )}
        </div>
      )}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`}
              className={`h-2 w-2 rounded-full ${idx === i ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
