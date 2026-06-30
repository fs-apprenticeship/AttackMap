"use client";

import { RemediationSection } from "@/components/dashboard/remediation-section";
import { useScanDetail } from "../scan-detail-context";

export default function RemediationPage() {
  const scan = useScanDetail();

  return <RemediationSection scan={scan} />;
}
