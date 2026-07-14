import { Globe, Network, Server, ShieldAlert } from "lucide-react";

import type { Finding, Host, RiskLevel, Scan, Severity } from "@/lib/types";
import { isWebService } from "@/lib/nmap/web-service";

import { severityOrder } from "@/lib/scans/severity";

export type DashboardFinding = Pick<
  Finding,
  "id" | "severity" | "title" | "evidence"
>;

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
  webServices: number;
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
    webServices: services.filter(isWebService).length,
    findings: scan.findings.length,
  };
}

export function getHostsForScan(scan: Scan): HostWithScan[] {
  return scan.hosts.map((host) => ({ ...host, scanFilename: scan.filename }));
}

export function getHostHighestRisk(
  host: Pick<Host, "services">,
): Severity {
  return (
    severityOrder.find((severity) =>
      host.services.some((service) => service.riskLevel === severity),
    ) ?? "info"
  );
}

export function getServicesForScan(scan: Scan) {
  return getHostsForScan(scan).flatMap((host) =>
    host.services.map((service) => ({ ...service, host })),
  );
}

export function getScanFindings(scan: Scan): DashboardFinding[] {
  // Findings are always rule-based — the factual layer. Sorted by severity.
  return [...scan.findings]
    .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
    .map(({ id, severity, title, evidence }) => ({ id, severity, title, evidence }));
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

export function getServiceRiskCounts(scan: Scan): SeverityCount[] {
  const services = scan.hosts.flatMap((host) => host.services);

  return severityOrder.map((severity) => ({
    severity,
    count: services.filter((service) => service.riskLevel === severity).length,
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

export type RiskAssessment = {
  score: number;
  level: RiskLevel;
};

// Strictly rule-based risk: the deterministic score plus the severity band it
// falls into. Independent of the AI summary so the gauge stays comparable
// across scans. Thresholds mirror `riskLevelFromScore` in the parser.
export function getRiskAssessment(scan: Scan): RiskAssessment {
  const score = getRiskScore(scan);
  const level: RiskLevel =
    score >= 70
      ? "critical"
      : score >= 45
        ? "high"
        : score >= 20
          ? "medium"
          : score > 0
            ? "low"
            : "info";
  return { score, level };
}

// Key metrics shown beneath the executive summary. The control panel (risk +
// exposures) lives in the right column; these are the at-a-glance counts.
export function getSummaryCards(scan: Scan) {
  const stats = getScanStats(scan);
  const criticalFindings = scan.findings.filter((finding) =>
    ["critical", "high"].includes(finding.severity),
  ).length;

  return [
    {
      label: "Open ports",
      value: stats.openPorts,
      icon: Network,
      tone: "amber",
    },
    {
      label: "Web services",
      value: stats.webServices,
      icon: Globe,
      tone: "cyan",
    },
    {
      label: "Critical findings",
      value: criticalFindings,
      icon: ShieldAlert,
      tone: "rose",
    },
    {
      label: "Hosts",
      value: stats.totalHosts,
      icon: Server,
      tone: "emerald",
    },
  ] as const;
}
