import { describe, expect, it } from "vitest";

import type { Finding, Host, Scan } from "@/lib/nmap/schema";
import { buildRiskTrend } from "./trend";

function makeHost(overrides: Partial<Host> = {}): Host {
  return {
    id: "host_1",
    ipAddress: "10.0.0.1",
    operatingSystem: "Linux",
    role: "server",
    internetExposed: false,
    services: [],
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding_1",
    severity: "high",
    title: "Example finding",
    evidence: "evidence",
    remediation: "remediation",
    ...overrides,
  };
}

function makeScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: "scan_1",
    filename: "scan.xml",
    target: "10.0.0.1",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    parsedAt: "2026-01-01T00:00:00.000Z",
    hosts: [],
    downHosts: [],
    findings: [],
    summary: {
      executive: "",
      riskScore: 0,
      riskLevel: "info",
      topRisks: [],
      source: "rule-based",
    },
    remediationPlan: { source: "rule-based", steps: [] },
    ...overrides,
  };
}

describe("buildRiskTrend", () => {
  it("returns one point per scan, using getRiskAssessment for score/level", () => {
    const scan = makeScan({
      hosts: [makeHost({ internetExposed: true })],
      findings: [makeFinding({ severity: "critical" })],
    });

    const [point] = buildRiskTrend([scan]);

    expect(point.scanId).toBe("scan_1");
    expect(point.filename).toBe("scan.xml");
    expect(point.hostCount).toBe(1);
    expect(point.findingCount).toBe(1);
    // critical finding (18) + exposed host (10) = 28 -> "medium"
    expect(point.riskScore).toBe(28);
    expect(point.riskLevel).toBe("medium");
  });

  it("plots at scannedAt when present, falling back to uploadedAt", () => {
    const withScannedAt = makeScan({ id: "a", scannedAt: "2026-02-01T00:00:00.000Z" });
    const withoutScannedAt = makeScan({
      id: "b",
      uploadedAt: "2026-03-01T00:00:00.000Z",
      scannedAt: undefined,
    });

    const points = buildRiskTrend([withScannedAt, withoutScannedAt]);

    expect(points.find((p) => p.scanId === "a")!.at).toBe("2026-02-01T00:00:00.000Z");
    expect(points.find((p) => p.scanId === "b")!.at).toBe("2026-03-01T00:00:00.000Z");
  });

  it("sorts chronologically regardless of input order", () => {
    const later = makeScan({ id: "later", uploadedAt: "2026-03-01T00:00:00.000Z" });
    const earlier = makeScan({ id: "earlier", uploadedAt: "2026-01-01T00:00:00.000Z" });
    const middle = makeScan({ id: "middle", uploadedAt: "2026-02-01T00:00:00.000Z" });

    const points = buildRiskTrend([later, earlier, middle]);

    expect(points.map((p) => p.scanId)).toEqual(["earlier", "middle", "later"]);
  });

  it("returns an empty array for no scans", () => {
    expect(buildRiskTrend([])).toEqual([]);
  });
});
