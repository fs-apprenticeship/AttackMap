"use client";

import { AttackSurfaceGraph } from "@/features/scans/detail/attack-surface-graph";
import { getServiceRiskCounts } from "@/lib/scans/metrics";
import { RiskDistribution } from "@/features/scans/detail/risk-distribution";
import { useScanDetail } from "../scan-detail-context";

export default function AttackSurfacePage() {
  const scan = useScanDetail();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
      <AttackSurfaceGraph hosts={scan.hosts} />
      <RiskDistribution
        counts={getServiceRiskCounts(scan)}
        description="Services grouped by risk"
      />
    </div>
  );
}
