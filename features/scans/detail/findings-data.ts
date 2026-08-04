import { severityOrder } from "@/features/scans/shared/utils";
import type { Severity } from "@/lib/types";
import type { DashboardFinding } from "@/lib/scans/metrics";

type FilterFindingsArgs = {
  findings: DashboardFinding[];
  normalizedQuery: string;
  severityFilters: Severity[];
};

export function filterFindings({
  findings,
  normalizedQuery,
  severityFilters,
}: FilterFindingsArgs): DashboardFinding[] {
  const query = normalizedQuery.trim().toLowerCase();
  const allowedSeverities = new Set(severityFilters);

  return findings
    .filter((finding) => {
      if (!allowedSeverities.has(finding.severity)) return false;
      if (!query) return true;

      return [finding.title, finding.evidence, finding.host]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query));
    })
    .sort(
      (a, b) =>
        severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
    );
}
