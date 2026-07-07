import { getScanStats } from "@/lib/scans/metrics";
import { severityOrder } from "@/features/scans/shared/utils";
import type { Scan, Severity } from "@/lib/types";

export type SortOption =
  | "parsed-desc"
  | "parsed-asc"
  | "risk-desc"
  | "findings-desc"
  | "hosts-desc"
  | "target-asc";

export type AiStatusFilter =
  | "summary-ai"
  | "summary-rule-based"
  | "remediation-ai"
  | "remediation-rule-based";

export type DateRangeFilter = "all" | "24h" | "7d" | "30d";

export type ScanAggregateStats = ReturnType<typeof getAggregateStats>;

export const riskFilterLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const defaultRiskFilters = [...severityOrder];

export const aiStatusLabels: Record<AiStatusFilter, string> = {
  "summary-ai": "AI summary",
  "summary-rule-based": "Rule-based summary",
  "remediation-ai": "AI remediation",
  "remediation-rule-based": "Rule-based remediation",
};

export const defaultAiStatusFilters = Object.keys(
  aiStatusLabels,
) as AiStatusFilter[];

export const dateRangeLabels: Record<DateRangeFilter, string> = {
  all: "All time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export const sortLabels: Record<SortOption, string> = {
  "parsed-desc": "Newest parsed",
  "parsed-asc": "Oldest parsed",
  "risk-desc": "Highest risk",
  "findings-desc": "Most findings",
  "hosts-desc": "Most hosts",
  "target-asc": "Target A-Z",
};

const dateRangeDays: Record<Exclude<DateRangeFilter, "all">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

const riskRank = Object.fromEntries(
  severityOrder.map((severity, index) => [
    severity,
    severityOrder.length - index,
  ]),
) as Record<Severity, number>;

function getSearchText(scan: Scan) {
  return [
    scan.filename,
    scan.target,
    scan.summary.riskLevel,
    ...scan.hosts.flatMap((host) => [
      host.hostname,
      host.ipAddress,
      host.operatingSystem,
      host.role,
      ...host.services.flatMap((service) => [
        service.serviceName,
        service.product,
        service.version,
        String(service.port),
      ]),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function compareScans(a: Scan, b: Scan, sort: SortOption) {
  const aStats = getScanStats(a);
  const bStats = getScanStats(b);

  switch (sort) {
    case "parsed-asc":
      return new Date(a.parsedAt).getTime() - new Date(b.parsedAt).getTime();
    case "risk-desc":
      return riskRank[b.summary.riskLevel] - riskRank[a.summary.riskLevel];
    case "findings-desc":
      return bStats.findings - aStats.findings;
    case "hosts-desc":
      return bStats.totalHosts - aStats.totalHosts;
    case "target-asc":
      return a.target.localeCompare(b.target);
    case "parsed-desc":
    default:
      return new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime();
  }
}

function isWithinDateRange(scan: Scan, range: DateRangeFilter) {
  if (range === "all") return true;

  const parsedAt = new Date(scan.parsedAt).getTime();
  const cutoff = Date.now() - dateRangeDays[range] * 24 * 60 * 60 * 1000;
  return parsedAt >= cutoff;
}

export function filterAndSortScans({
  scans,
  normalizedQuery,
  riskFilters,
  aiStatusFilters,
  dateRange,
  sort,
}: {
  scans: Scan[];
  normalizedQuery: string;
  riskFilters: Severity[];
  aiStatusFilters: AiStatusFilter[];
  dateRange: DateRangeFilter;
  sort: SortOption;
}) {
  return scans
    .filter((scan) => {
      const matchesRisk = riskFilters.includes(scan.summary.riskLevel);
      const matchesAiSummary = aiStatusFilters.includes(
        scan.summary.source === "ai" ? "summary-ai" : "summary-rule-based",
      );
      const matchesAiRemediation = aiStatusFilters.includes(
        scan.remediationPlan.source === "ai"
          ? "remediation-ai"
          : "remediation-rule-based",
      );
      const matchesDate = isWithinDateRange(scan, dateRange);
      const matchesSearch =
        normalizedQuery.length === 0 ||
        getSearchText(scan).includes(normalizedQuery);

      return (
        matchesRisk &&
        matchesAiSummary &&
        matchesAiRemediation &&
        matchesDate &&
        matchesSearch
      );
    })
    .sort((a, b) => compareScans(a, b, sort));
}

export function getAggregateStats(scans: Scan[]) {
  const highRiskScans = scans.filter((scan) =>
    ["critical", "high"].includes(scan.summary.riskLevel),
  ).length;
  const totalFindings = scans.reduce(
    (count, scan) => count + scan.findings.length,
    0,
  );
  const mostRecentScan = scans.reduce<Scan | null>((latest, scan) => {
    if (!latest) return scan;
    return new Date(scan.parsedAt) > new Date(latest.parsedAt) ? scan : latest;
  }, null);

  return {
    total: scans.length,
    highRiskScans,
    totalFindings,
    mostRecent: mostRecentScan?.parsedAt,
  };
}

export function getScanSeverityCounts(scan: Scan) {
  return severityOrder.map((severity) => ({
    severity,
    count: scan.findings.filter((finding) => finding.severity === severity)
      .length,
  }));
}

export function getTopFindings(scan: Scan) {
  return [...scan.findings]
    .sort(
      (a, b) =>
        severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
    )
    .slice(0, 3);
}
