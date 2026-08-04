import { describe, expect, it } from "vitest";

import { filterFindings } from "@/features/scans/detail/findings-data";
import type { DashboardFinding } from "@/lib/scans/metrics";

const findings: DashboardFinding[] = [
  {
    id: "low",
    severity: "low",
    title: "SSH is exposed",
    evidence: "Port 22 is open.",
    host: "gateway.example",
  },
  {
    id: "critical",
    severity: "critical",
    title: "Anonymous FTP login",
    evidence: "Anonymous access is enabled.",
    host: "10.0.0.4",
  },
  {
    id: "high",
    severity: "high",
    title: "Admin interface reachable",
    evidence: "HTTP endpoint responds.",
  },
];

describe("findings filtering", () => {
  it("searches title, evidence, and associated host case-insensitively", () => {
    expect(
      filterFindings({
        findings,
        normalizedQuery: "  GATEWAY  ",
        severityFilters: ["critical", "high", "medium", "low", "info"],
      }).map((finding) => finding.id),
    ).toEqual(["low"]);

    expect(
      filterFindings({
        findings,
        normalizedQuery: "anonymous access",
        severityFilters: ["critical", "high", "medium", "low", "info"],
      }).map((finding) => finding.id),
    ).toEqual(["critical"]);
  });

  it("applies severity selections and keeps severity-first ordering", () => {
    expect(
      filterFindings({
        findings,
        normalizedQuery: "",
        severityFilters: ["low", "critical"],
      }).map((finding) => finding.id),
    ).toEqual(["critical", "low"]);
  });

  it("returns no results for an empty selection or unmatched search", () => {
    expect(
      filterFindings({
        findings,
        normalizedQuery: "",
        severityFilters: [],
      }),
    ).toEqual([]);

    expect(
      filterFindings({
        findings,
        normalizedQuery: "postgres",
        severityFilters: ["critical", "high", "medium", "low", "info"],
      }),
    ).toEqual([]);
  });
});
