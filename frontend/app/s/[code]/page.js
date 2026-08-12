"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Self-hosted short link redirect (eduskill-campaign-admin-prompt.md,
// section 2 -- "shortened version of the link ... for anyone typing it
// manually"). /s/abc123 -> resolves to a campaign slug -> /c/that-slug.
export default function ShortLinkRedirect() {
  const params = useParams();
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params.code) return;
    api.get(`/api/public/campaigns/short/${params.code}`)
      .then((d) => router.replace(`/c/${d.slug}`))
      .catch(() => setError(true));
  }, [params.code]);

  if (error) {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Link not found</h1>
        <p className="text-gray-500">This short link doesn&apos;t exist or has expired.</p>
      </main>
    );
  }
  return <main className="flex min-h-[80vh] items-center justify-center text-gray-500">Redirecting…</main>;
}
