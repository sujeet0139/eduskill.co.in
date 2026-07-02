"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ContactPage() {
  const [site, setSite] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/public/site-info")
      .then((res) => setSite(res.site || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const email = site.institute_email || "info@eduskill.co.in";
  const phone = site.institute_phone || "";
  const address = site.institute_address || "";
  const whatsapp = site.social_whatsapp || "";
  // Strip non-digits so wa.me / tel: links are well-formed.
  const waNumber = (whatsapp || phone).replace(/[^\d]/g, "");

  const socials = [
    { key: "social_facebook", label: "Facebook" },
    { key: "social_instagram", label: "Instagram" },
    { key: "social_youtube", label: "YouTube" },
    { key: "social_linkedin", label: "LinkedIn" },
    { key: "social_twitter", label: "Twitter / X" },
  ].filter((s) => site[s.key]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">Contact Us</h1>
        <p className="mt-2 text-gray-600">
          We&apos;d love to hear from you. Reach out through any of the channels below.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact details */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Get in touch</h2>
            <ul className="space-y-4 text-sm">
              <li>
                <div className="font-semibold text-gray-500">Email</div>
                <a href={`mailto:${email}`} className="text-brand hover:underline">
                  {email}
                </a>
              </li>
              {phone && (
                <li>
                  <div className="font-semibold text-gray-500">Phone</div>
                  <a href={`tel:${phone}`} className="text-brand hover:underline">
                    {phone}
                  </a>
                </li>
              )}
              {address && (
                <li>
                  <div className="font-semibold text-gray-500">Address</div>
                  <p className="text-gray-700">{address}</p>
                </li>
              )}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {waNumber && (
                <a
                  href={`https://wa.me/91${waNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                >
                  Chat on WhatsApp
                </a>
              )}
              <a
                href={`mailto:${email}`}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Email Us
              </a>
            </div>

            {socials.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <div className="mb-2 text-sm font-semibold text-gray-500">Follow us</div>
                <div className="flex flex-wrap gap-3">
                  {socials.map((s) => (
                    <a
                      key={s.key}
                      href={site[s.key]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enquiry form (opens the user's email client — no backend needed) */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Send an enquiry</h2>
            <EnquiryForm toEmail={email} />
          </div>
        </div>
      )}
    </main>
  );
}

function EnquiryForm({ toEmail }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");

  function submit(e) {
    e.preventDefault();
    const subject = encodeURIComponent(`Website enquiry from ${name || "a visitor"}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${from}\n\n${message}`);
    window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        required
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <input
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        type="email"
        placeholder="Your email"
        required
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="How can we help?"
        rows={5}
        required
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Send Message
      </button>
    </form>
  );
}
