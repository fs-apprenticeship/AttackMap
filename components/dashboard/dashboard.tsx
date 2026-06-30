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
import { useGenerateSummary } from "@/lib/ai/use-generate-summary";

import {
  getRiskAssessment,
  getScanFindings,
  getServiceBreakdown,
  getSummaryCards,
} from "@/components/dashboard/data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

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
            href: `/scans/${scan.id}/attack-surface`,
            label: "Attack surface",
            value: `${scan.hosts.length} hosts`,
            icon: Workflow,
          },
          {
            href: `/scans/${scan.id}/findings`,
            label: "Findings",
            value: `${data.findings.length} findings`,
            icon: FileWarning,
          },
          {
            href: `/scans/${scan.id}/remediation`,
            label: "Remediation",
            value: `${scan.remediationPlan.steps.length} steps`,
            icon: ListChecks,
          },
          {
            href: `/scans/${scan.id}/services`,
            label: "Services",
            value: `${data.serviceBreakdown.length} categories`,
            icon: Network,
          },
          {
            href: `/scans/${scan.id}/hosts`,
            label: "Hosts",
            value: `${scan.hosts.length} assets`,
            icon: Server,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-400"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-950">
                  {item.label}
                </p>
                <p className="text-xs text-zinc-500">{item.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
