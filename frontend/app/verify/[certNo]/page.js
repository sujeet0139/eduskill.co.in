"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function VerifyCertificatePage() {
  const params = useParams();
  const certNo = decodeURIComponent(params.certNo || "");
  const [cert, setCert] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!certNo) return;
    api.get(`/api/verify/certificate/${encodeURIComponent(certNo)}`)
      .then((d) => { setCert(d.certificate); setTpl(d.template || null); })
      .catch((e) => setError(e.message || "Certificate not found"))
      .finally(() => setLoading(false));
  }, [certNo]);

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </main>
    );
  }

  if (error || !cert) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">✕</div>
        <h1 className="text-2xl font-bold text-gray-900">Certificate Not Found</h1>
        <p className="mt-2 max-w-sm text-gray-500">
          We couldn't verify a certificate with number <span className="font-mono">{certNo}</span>. Please check the number and try again.
        </p>
      </main>
    );
  }

  const revoked = cert.status === "revoked";
  const accent = tpl?.accent_color || "#1e3a8a";
  const heading = tpl?.heading || "Certificate of Completion";
  const courseName = cert.program_title || cert.course_title || "EduSkill Program";
  const dateStr = cert.issued_date ? new Date(cert.issued_date).toLocaleDateString() : "—";
  const scoreStr = cert.final_score_percent != null ? `${Number(cert.final_score_percent).toFixed(2)}%` : "";

  // Fill the template body placeholders; fall back to a sensible default line.
  const bodyText = (tpl?.body ||
    "This is to certify that {{name}} has successfully completed {{course}}.")
    .replace(/\{\{\s*name\s*\}\}/gi, cert.student_name || "")
    .replace(/\{\{\s*course\s*\}\}/gi, courseName)
    .replace(/\{\{\s*college\s*\}\}/gi, cert.college_name || "")
    .replace(/\{\{\s*date\s*\}\}/gi, dateStr)
    .replace(/\{\{\s*score\s*\}\}/gi, scoreStr)
    .replace(/\{\{\s*cert_no\s*\}\}/gi, cert.certificate_no || "");

  const signatures = [
    { name: tpl?.sig1_name, title: tpl?.sig1_title, image: tpl?.sig1_image },
    { name: tpl?.sig2_name, title: tpl?.sig2_title, image: tpl?.sig2_image },
    { name: tpl?.sig3_name, title: tpl?.sig3_title, image: tpl?.sig3_image },
  ].filter((s) => s.name || s.image);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Verification banner */}
      <div className={`mb-6 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium print:hidden ${revoked ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
        <span className="text-lg">{revoked ? "✕" : "✓"}</span>
        {revoked
          ? "This certificate has been REVOKED and is no longer valid."
          : "Verified — this is a genuine EduSkill certificate."}
      </div>

      {/* Printable certificate */}
      <div id="certificate" className="relative overflow-hidden rounded-xl border-4 bg-white p-10 text-center shadow-lg print:shadow-none" style={{ borderColor: accent }}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8rem] font-black select-none" style={{ color: accent, opacity: 0.05 }}>
          EDUSKILL
        </div>
        <div className="relative">
          {tpl?.logo_url ? (
            <img src={api.mediaUrl(tpl.logo_url)} alt="logo" className="mx-auto mb-2 h-16 object-contain" />
          ) : (
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">EduSkill.co.in</div>
          )}
          <h1 className="mt-4 text-3xl font-bold" style={{ color: accent }}>{heading}</h1>

          <p className="mt-2 text-3xl font-bold text-gray-900">{cert.student_name}</p>
          {cert.college_name && <p className="mt-1 text-sm text-gray-500">{cert.college_name}</p>}

          <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-gray-600">{bodyText}</p>

          {!tpl?.body && (
            <p className="mt-1 text-xl font-semibold" style={{ color: accent }}>{courseName}</p>
          )}
          {cert.final_score_percent != null && !/(\{\{\s*score\s*\}\})/i.test(tpl?.body || "") && (
            <p className="mt-2 text-sm text-gray-600">Final Score: <strong>{scoreStr}</strong></p>
          )}

          {/* Signatures (up to 3 authorities) */}
          {signatures.length > 0 && (
            <div className="mt-10 flex flex-wrap items-end justify-center gap-10">
              {signatures.map((s, i) => (
                <div key={i} className="text-center">
                  {s.image
                    ? <img src={api.mediaUrl(s.image)} alt="signature" className="mx-auto mb-1 h-12 object-contain" />
                    : <div className="mb-1 h-12" />}
                  <div className="mx-auto w-40 border-t border-gray-400 pt-1 text-sm font-semibold text-gray-800">{s.name || ""}</div>
                  {s.title && <div className="text-xs text-gray-500">{s.title}</div>}
                </div>
              ))}
            </div>
          )}

          {tpl?.seal_url && <img src={api.mediaUrl(tpl.seal_url)} alt="seal" className="mx-auto mt-6 h-20 object-contain opacity-90" />}

          <div className="mt-10 flex items-end justify-between text-left">
            <div>
              <div className="text-xs text-gray-400">Certificate No.</div>
              <div className="font-mono text-sm font-semibold text-gray-800">{cert.certificate_no}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Issued On</div>
              <div className="text-sm font-semibold text-gray-800">{dateStr}</div>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200 pt-3 text-xs text-gray-400">
            Verify authenticity at eduskill.co.in/verify/{cert.certificate_no}
          </div>
        </div>
      </div>

      {!revoked && (
        <div className="mt-6 text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      )}
    </main>
  );
}
