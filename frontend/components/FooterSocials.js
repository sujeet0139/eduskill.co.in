"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const LINKS = [
  ["social_whatsapp", "WhatsApp"],
  ["social_facebook", "Facebook"],
  ["social_instagram", "Instagram"],
  ["social_youtube", "YouTube"],
  ["social_linkedin", "LinkedIn"],
  ["social_twitter", "Twitter"],
];

export default function FooterSocials() {
  const [site, setSite] = useState({});

  useEffect(() => {
    api.get("/api/public/site-info").then((d) => setSite(d.site || {})).catch(() => {});
  }, []);

  const active = LINKS.filter(([key]) => site[key]);
  if (active.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
      {active.map(([key, label]) => (
        <a key={key} href={site[key]} target="_blank" rel="noreferrer" className="hover:text-white">
          {label}
        </a>
      ))}
    </div>
  );
}
