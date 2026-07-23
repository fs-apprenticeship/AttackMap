"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  FileWarning,
  ListChecks,
  Network,
  Server,
  Workflow,
} from "lucide-react";

import type { Scan } from "@/lib/types";
import { useGenerateSummary } from "@/features/scans/hooks/use-generate-summary";

import {
  getRiskAssessment,
  getScanFindings,
  getServiceBreakdown,
  getSummaryCards,
} from "@/lib/scans/metrics";
import { DashboardHeader } from "@/features/scans/detail/dashboard-header";

type DashboardProps = {
  scan: Scan;
};

export function Dashboard({ scan }: DashboardProps) {
  const data = useMemo(
    () => ({
      findings: getScanFindings(scan),
      serviceBreakdown: getServiceBreakdown(scan),
      summaryCards: getSummaryCards(scan),
      risk: getRiskAssessment(scan),
    }),
    [scan],
  );

  const summary = useGenerateSummary(scan);

  return (
    <div className="min-w-0 flex-1 space-y-6">
      <DashboardHeader
        activeScan={scan}
        risk={data.risk}
        findings={data.findings}
        stats={data.summaryCards}
        generating={summary.generating}
        error={summary.error}
        onGenerate={summary.generate}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            href: `/dashboard/scans/${scan.id}/attack-surface`,
            label: "Attack surface",
            value: `${scan.hosts.length} hosts`,
            icon: Workflow,
          },
          {
            href: `/dashboard/scans/${scan.id}/findings`,
            label: "Findings",
            value: `${data.findings.length} findings`,
            icon: FileWarning,
          },
          {
            href: `/dashboard/scans/${scan.id}/remediation`,
            label: "Remediation",
            value: `${scan.remediationPlan.steps.length} steps`,
            icon: ListChecks,
          },
          {
            href: `/dashboard/scans/${scan.id}/services`,
            label: "Services",
            value: `${data.serviceBreakdown.length} categories`,
            icon: Network,
          },
          {
            href: `/dashboard/scans/${scan.id}/hosts`,
            label: "Hosts",
            value: `${scan.hosts.length} assets`,
            icon: Server,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
