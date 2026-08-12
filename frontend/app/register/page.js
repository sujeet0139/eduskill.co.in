"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { validateStudentForm, isValidMobile } from "@/lib/validators";
import { StateDistrictSelect } from "@/components/StateDistrictSelect";

// Parse a field's `options` column which may arrive as a JSON string, an array
// of strings, or an array of { value, label } objects.
function parseOptions(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((o) =>
    typeof o === "object" && o !== null
      ? { value: o.value ?? o.label, label: o.label ?? o.value }
      : { value: o, label: o }
  );
}

const BENEFITS = [
  "University-recognized certificate with QR verification",
  "Mentor-led training in Hindi + English",
  "Real internship projects for your portfolio",
  "Job referrals & alumni network access",
];

export default function RegisterPage() {
  const [formFields, setFormFields] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(null);

  // State -> District narrows the College dropdown below it (item #23 --
  // reusing the same cascading component as the admin colleges form).
  // Not submitted as its own field; it just filters which colleges show.
  const [regState, setRegState] = useState("");
  const [regDistrictId, setRegDistrictId] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [fieldsRes, collegesRes] = await Promise.all([
          api.get("/api/public/registration-form"),
          api.get("/api/public/colleges"),
        ]);
        setFormFields(fieldsRes.fields || []);
        setColleges(collegesRes.colleges || []);
      } catch (err) {
        setError("Failed to load registration form. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Re-fetch the college list scoped to the chosen district. Falls back to
  // the full list when no district is picked, so this narrowing is a
  // convenience, not a hard requirement.
  useEffect(() => {
    const params = regDistrictId ? `?districtId=${encodeURIComponent(regDistrictId)}` : "";
    api.get(`/api/public/colleges${params}`).then((d) => setColleges(d.colleges || [])).catch(() => {});
  }, [regDistrictId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const validationError = validateStudentForm(formData);
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/api/students/register", formData);
      setSuccess(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Success screen ----
  if (success) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 px-4 py-16">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registration Successful!</h1>
          <p className="mt-2 text-gray-600">
            Welcome aboard{success.email ? `, ${success.email}` : ""}! Your account has been created.
          </p>
          <div className="mt-6 space-y-3 text-left">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-700">Your Reference Number</p>
              <p className="font-mono text-lg font-bold text-blue-900">{success.referenceNo}</p>
            </div>
            {success.enrollmentId && (
              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-xs font-medium text-orange-700">Enrollment ID</p>
                <p className="font-mono text-lg font-bold text-orange-900">{success.enrollmentId}</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Save these — you'll need them to log in and track your application.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Proceed to Login →
          </Link>
        </div>
      </main>
    );
  }

  // ---- Field renderer ----
  const renderField = (field) => {
    const required = !!field.is_mandatory;
    const baseInput =
      "w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";
    const label = (
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {field.label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
    );

    // College dropdown (special — fed from the colleges master table).
    // Narrowed by the State -> District cascade above it, which is why this
    // one field spans both columns.
    if (field.field_name === "collegeId") {
      return (
        <div key={field.field_name} className="md:col-span-2">
          <StateDistrictSelect
            state={regState}
            districtId={regDistrictId}
            onStateChange={setRegState}
            onDistrictChange={setRegDistrictId}
            className="mb-4"
          />
          <label className="block">
            {label}
            <select name="collegeId" required={required} onChange={handleChange} value={formData.collegeId || ""} className={`${baseInput} bg-white`}>
              <option value="">— Select your college —</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    // Admin-defined select fields (options come from the field config)
    if (field.type === "select") {
      const opts = parseOptions(field.options);
      return (
        <label key={field.field_name} className="block">
          {label}
          <select name={field.field_name} required={required} onChange={handleChange} value={formData[field.field_name] || ""} className={`${baseInput} bg-white`}>
            <option value="">— Select —</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      );
    }

    // Password field with show/hide toggle
    if (field.type === "password") {
      const pwd = formData[field.field_name] || "";
      const pwdLongEnough = pwd.length >= 6;
      return (
        <label key={field.field_name} className="block md:col-span-2">
          {label}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name={field.field_name}
              required={required}
              minLength={6}
              onChange={handleChange}
              value={pwd}
              className={`${baseInput} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {/* Persistent rule, not just a placeholder that disappears once typing
              starts — the point is the requirement stays visible before submit. */}
          <p className={`mt-1 text-xs ${pwd && !pwdLongEnough ? "text-red-500" : "text-gray-500"}`}>
            {pwd && pwdLongEnough ? "✓ " : ""}Minimum 6 characters.
          </p>
        </label>
      );
    }

    // Per-field input hints for the well-known identity fields.
    const hints = {
      phone: { inputMode: "numeric", maxLength: 10, placeholder: "10-digit mobile" },
      mobile: { inputMode: "numeric", maxLength: 10, placeholder: "10-digit mobile" },
      aadhar: { inputMode: "numeric", maxLength: 12, placeholder: "12-digit Aadhaar" },
      pan: { maxLength: 10, placeholder: "ABCDE1234F", style: { textTransform: "uppercase" } },
    }[field.field_name] || {};

    // Persistent format rule shown under the field before submit (not just a
    // placeholder), plus live valid/invalid feedback as the value changes.
    const persistentHints = {
      phone: "10 digits, no spaces, starting 6-9.",
      mobile: "10 digits, no spaces, starting 6-9.",
      aadhar: "12 digits, numbers only.",
    }[field.field_name];
    const value = formData[field.field_name] || "";
    const isMobileField = field.field_name === "phone" || field.field_name === "mobile";
    const mobileTouchedAndInvalid = isMobileField && value.length > 0 && !isValidMobile(value);

    // Generic input (text / email / tel / number)
    return (
      <label key={field.field_name} className="block">
        {label}
        <input
          type={field.type || "text"}
          name={field.field_name}
          required={required}
          onChange={handleChange}
          value={value}
          className={baseInput}
          {...hints}
        />
        {persistentHints && (
          <p className={`mt-1 text-xs ${mobileTouchedAndInvalid ? "text-red-500" : "text-gray-500"}`}>
            {persistentHints}
          </p>
        )}
      </label>
    );
  };

  return (
    <main className="min-h-[80vh] bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-5">
        {/* Left brand / benefits panel */}
        <aside className="hidden flex-col justify-between bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 p-8 text-white md:col-span-2 md:flex">
          <div>
            <span className="inline-block rounded-full border border-orange-400/40 bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-300">
              🎓 LNMU Affiliated Program
            </span>
            <h2 className="mt-5 text-2xl font-bold leading-snug">
              Start your <span className="text-orange-400">internship</span> & skill journey
            </h2>
            <p className="mt-2 text-sm text-blue-200">
              Register in under 2 minutes. Get certified. Get hired.
            </p>
            <ul className="mt-8 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-blue-100">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 rounded-xl bg-white/10 p-4">
            <div className="text-xs text-blue-200">Program Fee</div>
            <div className="text-2xl font-bold text-orange-400">₹5,999 <span className="text-sm font-normal text-blue-200">one-time</span></div>
          </div>
        </aside>

        {/* Right form panel */}
        <div className="p-6 sm:p-8 md:col-span-3">
          <h1 className="text-2xl font-bold text-gray-900">Student Registration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-blue-700 hover:underline">Login here</Link>
          </p>

          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              Loading registration form…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {formFields.map(renderField)}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:bg-gray-400"
              >
                {submitting ? "Please wait…" : "Register Now →"}
              </button>

              <p className="text-center text-xs text-gray-400">
                By registering you agree to our terms. Your details are managed securely.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
