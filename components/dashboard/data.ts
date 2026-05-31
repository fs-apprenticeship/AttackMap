import { Brain, Network, Server, ShieldAlert } from "lucide-react";

import domainControllerScan from "@/fixtures/scans/domain-controller.json";
import internalPlatformScan from "@/fixtures/scans/internal-platform.json";
import linuxHostScan from "@/fixtures/scans/linux-host.json";
import scanmePublicHostScan from "@/fixtures/scans/scanme-public-host.json";
import simpleWebServerScan from "@/fixtures/scans/simple-web-server.json";
import webServerScan from "@/fixtures/scans/web-server.json";
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

export const scans = [
  domainControllerScan,
  linuxHostScan,
  scanmePublicHostScan,
  webServerScan,
  internalPlatformScan,
  simpleWebServerScan,
] as Scan[];

export const activeScan = scans[0];

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

export const activeScanRisks = getScanRisks(activeScan);
export const activeScanRemediation = getScanRemediation(activeScan);

export const allHosts: HostWithScan[] = scans.flatMap((scan) =>
  scan.hosts.map((host) => ({ ...host, scanFilename: scan.filename })),
);

export const allServices = allHosts.flatMap((host) =>
  host.services.map((service) => ({ ...service, host })),
);

export const allFindings = scans.flatMap((scan) => scan.findings);

export const exposedAssets = allHosts.filter((host) => host.internetExposed).length;

export const riskyServices = allServices.filter((service) =>
  ["critical", "high"].includes(service.riskLevel),
).length;

export const highFindings = allFindings.filter((finding) =>
  ["critical", "high"].includes(finding.severity),
).length;

export const serviceBreakdown: ServiceBreakdownItem[] = Object.entries(
  allServices.reduce<Record<string, number>>((counts, service) => {
    const key = service.serviceName || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 7);

export const severityCounts: SeverityCount[] = severityOrder.map((severity) => ({
  severity,
  count: allFindings.filter((finding) => finding.severity === severity).length,
}));

export const riskScore = Math.min(
  100,
  highFindings * 18 +
    allFindings.filter((finding) => finding.severity === "medium").length * 7 +
    riskyServices * 8 +
    exposedAssets * 10,
);

export const summaryCards = [
  {
    label: "Hosts",
    value: allHosts.length,
    detail: `${exposedAssets} internet exposed`,
    icon: Server,
    tone: "cyan",
  },
  {
    label: "Open ports",
    value: allServices.length,
    detail: `${riskyServices} high-risk services`,
    icon: Network,
    tone: "amber",
  },
  {
    label: "Findings",
    value: allFindings.length,
    detail: `${highFindings} need priority review`,
    icon: ShieldAlert,
    tone: "rose",
  },
  {
    label: "AI risk score",
    value: riskScore,
    detail: "rule-backed preview",
    icon: Brain,
    tone: "emerald",
  },
] as const;
