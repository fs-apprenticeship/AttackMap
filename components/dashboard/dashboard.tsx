import { useMemo } from "react";

import type { Scan } from "@/lib/types";
import { useGenerateSummary } from "@/lib/ai/use-generate-summary";
import { useGenerateRemediation } from "@/lib/ai/use-generate-remediation";

import { AttackSurfaceGraph } from "@/components/dashboard/attack-surface-graph";
import {
  getHostsForScan,
  getScanFindings,
  getServiceBreakdown,
  getSeverityCounts,
  getSummaryCards,
} from "@/components/dashboard/data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FindingsPanel } from "@/components/dashboard/findings-panel";
import { HostInventoryTable } from "@/components/dashboard/host-inventory-table";
import { RemediationPlanPanel } from "@/components/dashboard/remediation-plan";
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
      findings: getScanFindings(scan),
      serviceBreakdown: getServiceBreakdown(scan),
      severityCounts: getSeverityCounts(scan),
      summaryCards: getSummaryCards(scan),
    }),
    [scan],
  );

  const summary = useGenerateSummary(scan);
  const remediation = useGenerateRemediation(scan);
  const activeHost = scan.hosts[0];

  return (
    <div className="min-w-0 flex-1 space-y-6">
      <DashboardHeader
        activeScan={scan}
        generating={summary.generating}
        error={summary.error}
        onGenerate={summary.generate}
      />
      <SummaryCards cards={data.summaryCards} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        {activeHost ? (
          <AttackSurfaceGraph host={activeHost} />
        ) : (
          <div className="flex min-h-[430px] items-center justify-center rounded-md border bg-white text-sm text-zinc-500 shadow-sm">
            No live hosts found in this scan.
          </div>
        )}
        <RiskDistribution counts={data.severityCounts} />
      </div>

      <FindingsPanel findings={data.findings} />
      <RemediationPlanPanel
        plan={scan.remediationPlan}
        generating={remediation.generating}
        error={remediation.error}
        onGenerate={remediation.generate}
      />

      <ServiceBreakdown services={data.serviceBreakdown} />
      <HostInventoryTable hosts={data.hosts} />
    </div>
  );
}
