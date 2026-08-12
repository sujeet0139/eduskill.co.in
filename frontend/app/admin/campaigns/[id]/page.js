"use client";

import { useParams } from "next/navigation";
import CampaignBuilder from "@/components/CampaignBuilder";

export default function EditCampaignPage() {
  const params = useParams();
  return <CampaignBuilder campaignId={params.id} />;
}
