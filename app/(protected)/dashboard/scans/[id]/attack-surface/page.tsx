"use client";

import { AttackSurfaceGraph } from "@/features/scans/detail/attack-surface-graph";
import { useScanDetail } from "../scan-detail-context";

export default function AttackSurfacePage() {
  const scan = useScanDetail();

  return <AttackSurfaceGraph hosts={scan.hosts} />;
}
