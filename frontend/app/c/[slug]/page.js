"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isValidMobile } from "@/lib/validators";

// Public campaign landing/registration flow (eduskill-campaign-admin-prompt.md).
// Four steps: 1) hero/benefits landing, 2) pre-filled registration
// (college/program/course/batch come from the campaign, not the student),
// 3) optional feedback, 4) templated confirmation.

function renderTemplate(template, vars) {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (match, key) => (vars[key] != null && vars[key] !== "" ? vars[key] : match));
}

export default function CampaignPage() {
  const params = useParams();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null); // 'active' | 'paused' | 'expired' | 'not_started' | 'notfound' | 'error'
  const [campaign, setCampaign] = useState(null);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState(null); // { referenceNo, enrollmentId, studentId, ... }

  const [rating, setRating] = useState(0);
  const [interests, setInterests] = useState([]);
  const [counselorOptIn, setCounselorOptIn] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/api/public/campaigns/${slug}`)
      .then((d) => { setState(d.state); setCampaign(d.campaign); })
      .catch(() => setState("notfound"))
      .finally(() => setLoading(false));
  }, [slug]);

  const goToForm = () => {
    api.post(`/api/public/campaigns/${slug}/start`, {}).catch(() => {});
    setStep(2);
  };

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submitRegistration = async (e) => {
    e.preventDefault();
    setError("");
    if (form.phone && !isValidMobile(form.phone)) {
      setError("Mobile number must be a valid 10-digit Indian number (starting 6-9).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/api/public/campaigns/${slug}/register`, form);
      setRegistration(res);
      setStep(res.feedback_enabled ? 3 : 4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleInterest = (label) => setInterests((prev) => prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    setFeedbackSubmitting(true);
    try {
      await api.post(`/api/public/campaigns/${slug}/feedback`, {
        studentId: registration.studentId, rating, interests, counselor_opt_in: counselorOptIn,
      });
    } catch { /* non-fatal -- still show confirmation either way */ }
    finally {
      setFeedbackSubmitting(false);
      setStep(4);
    }
  };

  if (loading) {
    return <main className="flex min-h-[80vh] items-center justify-center text-gray-500">Loading…</main>;
  }

  if (state === "notfound" || state === "error") {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Link not found</h1>
        <p className="text-gray-500">This registration link doesn&apos;t exist. Please check the URL or QR code.</p>
      </main>
    );
  }
  if (state === "paused") {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Registration paused</h1>
        <p className="text-gray-500">This registration link is temporarily paused. Please check back later.</p>
      </main>
    );
  }
  if (state === "not_started") {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Not open yet</h1>
        <p className="text-gray-500">This registration link isn&apos;t open yet. Please check back soon.</p>
      </main>
    );
  }
  if (state === "expired") {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">This link has expired</h1>
        <p className="text-gray-500">
          This registration window has closed. Visit{" "}
          <Link href="/register" className="font-medium text-blue-700 hover:underline">our main registration page</Link>{" "}
          to sign up for other programs.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[80vh] bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* STEP 1 -- landing / benefits */}
        {step === 1 && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
            {campaign.hero_tag && (
              <span className="inline-block rounded-full border border-orange-400/40 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                {campaign.hero_tag}
              </span>
            )}
            <h1 className="mt-4 text-3xl font-bold text-gray-900">{campaign.headline || campaign.name}</h1>
            {campaign.subheading && <p className="mt-2 text-gray-600">{campaign.subheading}</p>}
            {(campaign.course_title || campaign.program_title) && (
              <p className="mt-1 text-sm text-gray-500">{campaign.course_title || campaign.program_title}{campaign.batch_name ? ` — ${campaign.batch_name}` : ""}</p>
            )}

            {campaign.benefits && campaign.benefits.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                {campaign.benefits.map((b, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-2xl">{b.icon || "✓"}</div>
                    <p className="mt-1 font-semibold text-gray-900">{b.title}</p>
                    {b.description && <p className="text-sm text-gray-500">{b.description}</p>}
                  </div>
                ))}
              </div>
            )}

            <button onClick={goToForm} className="mt-8 w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-600">
              Register Now →
            </button>
          </div>
        )}

        {/* STEP 2 -- registration form (college/program/course/batch are
            fixed by the campaign, never shown as a choice here) */}
        {step === 2 && (
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Complete your registration</h2>
            <p className="mt-1 text-sm text-gray-500">
              {campaign.course_title || campaign.program_title}{campaign.batch_name ? ` — ${campaign.batch_name}` : ""}{campaign.college_name ? ` at ${campaign.college_name}` : ""}
            </p>
            <form onSubmit={submitRegistration} className="mt-6 space-y-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Full Name *</span>
                <input name="name" required value={form.name} onChange={change}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Email *</span>
                <input type="email" name="email" required value={form.email} onChange={change}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Mobile / WhatsApp Number *</span>
                <input name="phone" required inputMode="numeric" maxLength={10} value={form.phone} onChange={change} placeholder="10-digit mobile"
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none" />
                <p className="mt-1 text-xs text-gray-500">10 digits, no spaces, starting 6-9.</p>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Password *</span>
                <input type="password" name="password" required minLength={6} value={form.password} onChange={change}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none" />
                <p className="mt-1 text-xs text-gray-500">Minimum 6 characters.</p>
              </label>
              <button type="submit" disabled={submitting}
                className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:bg-gray-400">
                {submitting ? "Please wait…" : "Complete Registration"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3 -- feedback (only if the campaign has it enabled) */}
        {step === 3 && (
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900">Quick feedback</h2>
            <p className="mt-1 text-sm text-gray-500">Helps us plan future sessions — takes 10 seconds.</p>
            <form onSubmit={submitFeedback} className="mt-6 space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">How was today&apos;s session?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)}
                      className={`h-10 w-10 rounded-full text-lg ${n <= rating ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {campaign.interests && campaign.interests.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">What else are you interested in?</p>
                  <div className="flex flex-wrap gap-2">
                    {campaign.interests.map((label) => (
                      <button key={label} type="button" onClick={() => toggleInterest(label)}
                        className={`rounded-full border-2 px-3 py-1.5 text-sm ${interests.includes(label) ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {campaign.counselor_toggle_enabled && (
                <label className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
                  <input type="checkbox" checked={counselorOptIn} onChange={(e) => setCounselorOptIn(e.target.checked)} />
                  <span className="text-sm text-blue-900">I&apos;d like a counselor to call me with more details.</span>
                </label>
              )}

              <button type="submit" disabled={feedbackSubmitting}
                className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:bg-gray-400">
                {feedbackSubmitting ? "Submitting…" : "Continue"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 4 -- confirmation, from the campaign's own template */}
        {step === 4 && registration && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
            <h1 className="text-2xl font-bold text-gray-900">You&apos;re all set!</h1>
            <p className="mt-3 text-gray-700">
              {renderTemplate(campaign.confirmation_template, {
                name: registration.name,
                course: campaign.course_title || campaign.program_title || "",
                batch: campaign.batch_name || "",
                start_date: campaign.batch_start_date ? new Date(campaign.batch_start_date).toLocaleDateString() : "",
                group_link: campaign.group_link || "",
              })}
            </p>
            <div className="mt-6 rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-700">Your Reference Number</p>
              <p className="font-mono text-lg font-bold text-blue-900">{registration.referenceNo}</p>
            </div>
            <Link href="/login" className="mt-6 inline-block w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-800">
              Proceed to Login →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
