"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { adminAuth } from "@/lib/auth";
import { PageHeader, TableWrap, Th, Td } from "@/components/admin";

// Side-by-side funnel comparison across 2+ campaigns (section 5).
export default function CompareCampaignsPage() {
  const params = useSearchParams();
  const ids = params.get("ids") || "";
  const [funnels, setFunnels] = useState([]);
  const [error, setError] = useState("");
  const token = () => adminAuth.token();

  useEffect(() => {
    if (!ids) return;
    api.get(`/api/campaigns/compare?ids=${ids}`, token())
      .then((d) => setFunnels(d.funnels || []))
      .catch((e) => setError(e.message));
  }, [ids]);

  const rows = [
    { key: "link_opens", label: "Link opens" },
    { key: "registrations_started", label: "Registrations started" },
    { key: "registrations_completed", label: "Registrations completed" },
    { key: "feedback_submitted", label: "Feedback submitted" },
    { key: "counselor_optins", label: "Counselor opt-ins" },
  ];

  return (
    <>
      <PageHeader title="Compare Campaigns" subtitle="Which visits are actually worth repeating." />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <TableWrap>
        <thead className="bg-gray-50">
          <tr>
            <Th>Metric</Th>
            {funnels.map((f) => <Th key={f.campaign_id}>{f.name}</Th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.key}>
              <Td className="font-medium">{r.label}</Td>
              {funnels.map((f) => <Td key={f.campaign_id}>{f[r.key]}</Td>)}
            </tr>
          ))}
          {funnels.length > 0 && (
            <tr>
              <Td className="font-medium">Completion rate</Td>
              {funnels.map((f) => (
                <Td key={f.campaign_id}>{f.link_opens ? `${((f.registrations_completed / f.link_opens) * 100).toFixed(0)}%` : "—"}</Td>
              ))}
            </tr>
          )}
        </tbody>
      </TableWrap>
    </>
  );
}
