import type { Scan } from "@/lib/nmap/schema";
import { getRiskAssessment, getScanStats } from "@/lib/scans/metrics";

export type RiskTrendPoint = {
  scanId: string;
  filename: string;
  /** ISO timestamp the point is plotted at — scannedAt when known, else uploadedAt. */
  at: string;
  riskScore: number;
  riskLevel: Scan["summary"]["riskLevel"];
  hostCount: number;
  findingCount: number;
};

/**
 * Chronological risk-score trend for a set of scans (expected to already
 * share a `target` — see `listScansForTarget`). Risk score/level always come
 * from `getRiskAssessment`, the same rule-based, AI-independent calculation
 * the single-scan gauge uses, so trend points stay comparable to each other
 * regardless of which scans got an AI summary.
 */
export function buildRiskTrend(scans: Scan[]): RiskTrendPoint[] {
  return scans
    .map((scan) => {
      const risk = getRiskAssessment(scan);
      const stats = getScanStats(scan);
      return {
        scanId: scan.id,
        filename: scan.filename,
        at: scan.scannedAt ?? scan.uploadedAt,
        riskScore: risk.score,
        riskLevel: risk.level,
        hostCount: stats.totalHosts,
        findingCount: stats.findings,
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}
