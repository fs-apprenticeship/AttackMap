"use client";

import { RemediationSection } from "@/features/scans/detail/remediation-section";
import { useScanDetail } from "../scan-detail-context";

export default function RemediationPage() {
  const scan = useScanDetail();

  return <RemediationSection scan={scan} />;
}
