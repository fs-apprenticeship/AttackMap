import { Brain, Network, Server, ShieldAlert } from "lucide-react";

import type { Finding, Host, Scan, Severity } from "@/lib/types";

import { severityOrder } from "./utils";

export type DashboardRisk = Pick<
  Finding,
  "severity" | "title" | "evidence" | "remediation"
>;

export type DashboardRemediation = {
  priority: "now" | "next" | "later";
  title: string;
  description: string;
};

export type HostWithScan = Host & {
  scanFilename: string;
};

export type ServiceBreakdownItem = [service: string, count: number];

export type SeverityCount = {
  severity: Severity;
  count: number;
};

export type ScanStats = {
  totalHosts: number;
  openPorts: number;
  riskyServices: number;
  findings: number;
};

export function getScanStats(scan: Scan): ScanStats {
  const services = scan.hosts.flatMap((host) => host.services);

  return {
    totalHosts: scan.hosts.length,
    openPorts: services.length,
    riskyServices: services.filter((service) =>
      ["critical", "high"].includes(service.riskLevel),
    ).length,
    findings: scan.findings.length,
  };
}

export function getHostsForScan(scan: Scan): HostWithScan[] {
  return scan.hosts.map((host) => ({ ...host, scanFilename: scan.filename }));
}

export function getServicesForScan(scan: Scan) {
  return getHostsForScan(scan).flatMap((host) =>
    host.services.map((service) => ({ ...service, host })),
  );
}

export function getScanRisks(scan: Scan): DashboardRisk[] {
  if (scan.findings.length > 0) {
    return scan.findings.map(({ severity, title, evidence, remediation }) => ({
      severity,
      title,
      evidence,
      remediation,
    }));
  }

  return scan.summary.topRisks.map((title) => ({
    severity: scan.summary.riskLevel,
    title,
    evidence: "Generated from parsed scan data.",
    remediation:
      scan.summary.remediation[0] ??
      "Maintain least exposure and keep detected services patched.",
  }));
}

export function getScanRemediation(scan: Scan): DashboardRemediation[] {
  const remediation =
    scan.findings.length > 0
      ? scan.findings.map((finding) => ({
          title: finding.title,
          description: finding.remediation,
        }))
      : scan.summary.remediation.map((description, index) => ({
          title: index === 0 ? "Maintain least exposure" : "Keep services patched",
          description,
        }));

  return remediation.slice(0, 3).map((item, index) => ({
    priority: index === 0 ? "now" : index === 1 ? "next" : "later",
    ...item,
  }));
}

export function getServiceBreakdown(scan: Scan): ServiceBreakdownItem[] {
  return Object.entries(
    getServicesForScan(scan).reduce<Record<string, number>>((counts, service) => {
      const key = service.serviceName || "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
}

export function getSeverityCounts(scan: Scan): SeverityCount[] {
  return severityOrder.map((severity) => ({
    severity,
    count: scan.findings.filter((finding) => finding.severity === severity).length,
  }));
}

export function getRiskScore(scan: Scan) {
  const stats = getScanStats(scan);
  const exposedAssets = scan.hosts.filter((host) => host.internetExposed).length;
  const highFindings = scan.findings.filter((finding) =>
    ["critical", "high"].includes(finding.severity),
  ).length;
  const mediumFindings = scan.findings.filter(
    (finding) => finding.severity === "medium",
  ).length;

  return Math.min(
    100,
    highFindings * 18 +
      mediumFindings * 7 +
      stats.riskyServices * 8 +
      exposedAssets * 10,
  );
}

export function getSummaryCards(scan: Scan) {
  const stats = getScanStats(scan);
  const exposedAssets = scan.hosts.filter((host) => host.internetExposed).length;
  const highFindings = scan.findings.filter((finding) =>
    ["critical", "high"].includes(finding.severity),
  ).length;

  return [
    {
      label: "Hosts",
      value: stats.totalHosts,
      detail: `${exposedAssets} internet exposed`,
      icon: Server,
      tone: "cyan",
    },
    {
      label: "Open ports",
      value: stats.openPorts,
      detail: `${stats.riskyServices} high-risk services`,
      icon: Network,
      tone: "amber",
    },
    {
      label: "Findings",
      value: stats.findings,
      detail: `${highFindings} need priority review`,
      icon: ShieldAlert,
      tone: "rose",
    },
    {
      label: "AI risk score",
      value: scan.summary.riskScore,
      detail: `${scan.summary.source === "ai" ? "AI" : "rule-based"} estimate`,
      icon: Brain,
      tone: "emerald",
    },
  ] as const;
}
