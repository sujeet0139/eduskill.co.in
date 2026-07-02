"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Shows the institute's contact details + social/community channels in the
// student panel, so students can call, email, and join the WhatsApp/YouTube/etc.
// channels. All values come from admin-managed Settings (site-info).
export default function InstituteConnect() {
  const [site, setSite] = useState(null);

  useEffect(() => {
    api.get("/api/public/site-info").then((d) => setSite(d.site || {})).catch(() => {});
  }, []);

  if (!site) return null;

  const wa = (site.social_whatsapp || "").trim();
  const channels = [
    { key: "social_whatsapp", label: "Join WhatsApp", cls: "bg-green-500 hover:bg-green-600" },
    { key: "social_youtube", label: "Subscribe on YouTube", cls: "bg-red-600 hover:bg-red-700" },
    { key: "social_instagram", label: "Follow on Instagram", cls: "bg-pink-600 hover:bg-pink-700" },
    { key: "social_facebook", label: "Like on Facebook", cls: "bg-blue-700 hover:bg-blue-800" },
    { key: "social_linkedin", label: "Connect on LinkedIn", cls: "bg-sky-700 hover:bg-sky-800" },
    { key: "social_twitter", label: "Follow on X", cls: "bg-gray-900 hover:bg-black" },
  ].filter((c) => site[c.key]);

  const hasContact = site.institute_email || site.institute_phone;
  if (!hasContact && channels.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold text-gray-900">Connect with {site.institute_name || "EduSkill"}</h2>
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {hasContact && (
          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {site.institute_phone && (
              <div>
                <span className="text-gray-500">Phone: </span>
                <a href={`tel:${site.institute_phone}`} className="font-medium text-brand hover:underline">{site.institute_phone}</a>
              </div>
            )}
            {site.institute_email && (
              <div>
                <span className="text-gray-500">Email: </span>
                <a href={`mailto:${site.institute_email}`} className="font-medium text-brand hover:underline">{site.institute_email}</a>
              </div>
            )}
          </div>
        )}
        {channels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => (
              <a
                key={c.key}
                href={c.key === "social_whatsapp" && !/^https?:/.test(wa) ? `https://wa.me/${wa.replace(/[^\d]/g, "")}` : site[c.key]}
                target="_blank"
                rel="noreferrer"
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${c.cls}`}
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
