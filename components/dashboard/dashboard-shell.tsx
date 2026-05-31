"use client";

import { useMemo, useState } from "react";

import { AiSummaryPanel } from "@/components/dashboard/ai-summary-panel";
import { AttackSurfaceGraph } from "@/components/dashboard/attack-surface-graph";
import {
  getHostsForScan,
  getScanRemediation,
  getScanRisks,
  getServiceBreakdown,
  getSeverityCounts,
  getSummaryCards,
  scans,
} from "@/components/dashboard/data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { HostInventoryTable } from "@/components/dashboard/host-inventory-table";
import { RemediationGrid } from "@/components/dashboard/remediation-grid";
import { RiskDistribution } from "@/components/dashboard/risk-distribution";
import { ServiceBreakdown } from "@/components/dashboard/service-breakdown";
import { SummaryCards } from "@/components/dashboard/summary-cards";

export function DashboardShell() {
  const [activeScanId, setActiveScanId] = useState(scans[0].id);
  const activeScan =
    scans.find((scan) => scan.id === activeScanId) ?? scans[0];
  const activeHost = activeScan.hosts[0];

  const dashboardData = useMemo(
    () => ({
      hosts: getHostsForScan(activeScan),
      remediation: getScanRemediation(activeScan),
      risks: getScanRisks(activeScan),
      serviceBreakdown: getServiceBreakdown(activeScan),
      severityCounts: getSeverityCounts(activeScan),
      summaryCards: getSummaryCards(activeScan),
    }),
    [activeScan],
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-5 lg:flex-row lg:px-6">
        <DashboardSidebar
          scans={scans}
          activeScanId={activeScan.id}
          onSelectScan={setActiveScanId}
        />

        <div className="min-w-0 flex-1 space-y-6">
          <DashboardHeader activeScan={activeScan} />
          <SummaryCards cards={dashboardData.summaryCards} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
            <AttackSurfaceGraph host={activeHost} />
            <AiSummaryPanel risks={dashboardData.risks} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ServiceBreakdown services={dashboardData.serviceBreakdown} />
            <RiskDistribution counts={dashboardData.severityCounts} />
          </div>

          <HostInventoryTable hosts={dashboardData.hosts} />
          <RemediationGrid remediation={dashboardData.remediation} />
        </div>
      </div>
    </main>
  );
}
