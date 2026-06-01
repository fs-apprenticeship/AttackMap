import { useMemo } from "react";

import type { Scan } from "@/lib/types";

import { AiSummaryPanel } from "@/components/dashboard/ai-summary-panel";
import { AttackSurfaceGraph } from "@/components/dashboard/attack-surface-graph";
import {
  getHostsForScan,
  getScanRemediation,
  getScanRisks,
  getServiceBreakdown,
  getSeverityCounts,
  getSummaryCards,
} from "@/components/dashboard/data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { HostInventoryTable } from "@/components/dashboard/host-inventory-table";
import { RemediationGrid } from "@/components/dashboard/remediation-grid";
import { RiskDistribution } from "@/components/dashboard/risk-distribution";
import { ServiceBreakdown } from "@/components/dashboard/service-breakdown";
import { SummaryCards } from "@/components/dashboard/summary-cards";

type DashboardProps = {
  scan: Scan;
};

export function Dashboard({ scan }: DashboardProps) {
  const data = useMemo(
    () => ({
      hosts: getHostsForScan(scan),
      remediation: getScanRemediation(scan),
      risks: getScanRisks(scan),
      serviceBreakdown: getServiceBreakdown(scan),
      severityCounts: getSeverityCounts(scan),
      summaryCards: getSummaryCards(scan),
    }),
    [scan],
  );

  const activeHost = scan.hosts[0];

  return (
    <div className="min-w-0 flex-1 space-y-6">
      <DashboardHeader activeScan={scan} />
      <SummaryCards cards={data.summaryCards} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        {activeHost ? (
          <AttackSurfaceGraph host={activeHost} />
        ) : (
          <div className="flex min-h-[430px] items-center justify-center rounded-md border bg-white text-sm text-zinc-500 shadow-sm">
            No live hosts found in this scan.
          </div>
        )}
        <AiSummaryPanel risks={data.risks} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ServiceBreakdown services={data.serviceBreakdown} />
        <RiskDistribution counts={data.severityCounts} />
      </div>

      <HostInventoryTable hosts={data.hosts} />
      <RemediationGrid remediation={data.remediation} />
    </div>
  );
}
