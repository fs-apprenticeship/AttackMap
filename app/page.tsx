import { AiSummaryPanel } from "@/components/dashboard/ai-summary-panel";
import { AttackSurfaceGraph } from "@/components/dashboard/attack-surface-graph";
import {
  activeScan,
  activeScanRemediation,
  activeScanRisks,
  allHosts,
  scans,
  serviceBreakdown,
  severityCounts,
} from "@/components/dashboard/data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { HostInventoryTable } from "@/components/dashboard/host-inventory-table";
import { RemediationGrid } from "@/components/dashboard/remediation-grid";
import { RiskDistribution } from "@/components/dashboard/risk-distribution";
import { ServiceBreakdown } from "@/components/dashboard/service-breakdown";
import { SummaryCards } from "@/components/dashboard/summary-cards";

export default function Home() {
  const activeHost = activeScan.hosts[0];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-5 lg:px-6">
        <DashboardSidebar scans={scans} activeScanId={activeScan.id} />

        <div className="min-w-0 flex-1 space-y-6">
          <DashboardHeader activeScan={activeScan} />
          <SummaryCards />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
            <AttackSurfaceGraph host={activeHost} />
            <AiSummaryPanel risks={activeScanRisks} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ServiceBreakdown services={serviceBreakdown} />
            <RiskDistribution counts={severityCounts} />
          </div>

          <HostInventoryTable hosts={allHosts} />
          <RemediationGrid remediation={activeScanRemediation} />
        </div>
      </div>
    </main>
  );
}
