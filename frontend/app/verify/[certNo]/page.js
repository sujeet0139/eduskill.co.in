"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function VerifyCertificatePage() {
  const params = useParams();
  const certNo = decodeURIComponent(params.certNo || "");
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!certNo) return;
    api.get(`/api/verify/certificate/${encodeURIComponent(certNo)}`)
      .then((d) => setCert(d.certificate))
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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Verification banner */}
      <div className={`mb-6 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${revoked ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
        <span className="text-lg">{revoked ? "✕" : "✓"}</span>
        {revoked
          ? "This certificate has been REVOKED and is no longer valid."
          : "Verified — this is a genuine EduSkill certificate."}
      </div>

      {/* Printable certificate */}
      <div id="certificate" className="relative overflow-hidden rounded-xl border-4 border-blue-900 bg-white p-10 text-center shadow-lg print:border-blue-900 print:shadow-none">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8rem] font-black text-blue-900/5 select-none">
          EDUSKILL
        </div>
        <div className="relative">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">EduSkill.co.in</div>
          <h1 className="mt-4 text-3xl font-bold text-blue-900">Certificate of Completion</h1>
          <p className="mt-6 text-gray-500">This is to certify that</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{cert.student_name}</p>
          {cert.college_name && <p className="mt-1 text-sm text-gray-500">{cert.college_name}</p>}
          <p className="mt-6 text-gray-500">has successfully completed</p>
          <p className="mt-1 text-xl font-semibold text-blue-800">
            {cert.program_title || cert.course_title || "EduSkill Program"}
          </p>
          {cert.final_score_percent != null && (
            <p className="mt-2 text-sm text-gray-600">Final Score: <strong>{Number(cert.final_score_percent).toFixed(2)}%</strong></p>
          )}

          <div className="mt-10 flex items-end justify-between text-left">
            <div>
              <div className="text-xs text-gray-400">Certificate No.</div>
              <div className="font-mono text-sm font-semibold text-gray-800">{cert.certificate_no}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Issued On</div>
              <div className="text-sm font-semibold text-gray-800">
                {cert.issued_date ? new Date(cert.issued_date).toLocaleDateString() : "—"}
              </div>
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
            className="rounded-lg bg-blue-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-800"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      )}
    </main>
  );
}
