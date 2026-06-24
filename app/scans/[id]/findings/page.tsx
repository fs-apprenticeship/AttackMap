"use client";

import { getScanFindings } from "@/components/dashboard/data";
import { FindingsPanel } from "@/components/dashboard/findings-panel";
import { useScanDetail } from "../scan-detail-context";

export default function FindingsPage() {
  const scan = useScanDetail();

  return <FindingsPanel findings={getScanFindings(scan)} />;
}
