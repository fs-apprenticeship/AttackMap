"use client";

import { Dashboard } from "@/features/scans/detail/dashboard";
import { useScanDetail } from "./scan-detail-context";

export default function ScanDetailPage() {
  const scan = useScanDetail();

  return <Dashboard scan={scan} />;
}
