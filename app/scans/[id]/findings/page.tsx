"use client";

import { getScanFindings } from "@/lib/scans/metrics";
import { FindingsPanel } from "@/features/scans/detail/findings-panel";
import { useScanDetail } from "../scan-detail-context";

export default function FindingsPage() {
  const scan = useScanDetail();

  return <FindingsPanel findings={getScanFindings(scan)} />;
}
