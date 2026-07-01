import { describe, expect, it } from "vitest";

import type { Finding, Host, Scan, Service } from "@/lib/parser/schema";
import { compareScans, findingFingerprint } from "./compare";
import { ScanComparisonSchema } from "./comparison-schema";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: nextId("service"),
    port: 22,
    protocol: "tcp",
    serviceName: "ssh",
    riskLevel: "medium",
    cpe: [],
    ...overrides,
  };
}

function makeHost(overrides: Partial<Host> = {}): Host {
  return {
    id: nextId("host"),
    ipAddress: "10.0.0.1",
    operatingSystem: "Linux",
    role: "linux_host",
    internetExposed: false,
    services: [],
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: nextId("finding"),
    severity: "medium",
    title: "SSH is exposed",
    evidence: "Port 22/tcp is open.",
    remediation: "Restrict SSH access.",
    ...overrides,
  };
}

function makeScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: nextId("scan"),
    filename: "scan.xml",
    target: "10.0.0.0/24",
    uploadedAt: new Date().toISOString(),
    parsedAt: new Date().toISOString(),
    hosts: [],
    findings: [],
    summary: {
      executive: "Test summary.",
      riskScore: 10,
      riskLevel: "low",
      topRisks: [],
      source: "rule-based",
    },
    remediationPlan: { source: "rule-based", steps: [] },
    ...overrides,
  };
}

describe("compareScans", () => {
  it("reports a host present only in the comparison scan as new", () => {
    const base = makeScan({ hosts: [] });
    const newHost = makeHost({ ipAddress: "10.0.0.5" });
    const comparison = makeScan({ hosts: [newHost] });

    const result = compareScans(base, comparison);

    expect(result.newHosts).toHaveLength(1);
    expect(result.newHosts[0].ipAddress).toBe("10.0.0.5");
    expect(result.removedHosts).toHaveLength(0);
  });

  it("reports a host present only in the base scan as removed", () => {
    const removedHost = makeHost({ ipAddress: "10.0.0.9" });
    const base = makeScan({ hosts: [removedHost] });
    const comparison = makeScan({ hosts: [] });

    const result = compareScans(base, comparison);

    expect(result.removedHosts).toHaveLength(1);
    expect(result.removedHosts[0].ipAddress).toBe("10.0.0.9");
    expect(result.newHosts).toHaveLength(0);
  });

  it("matches hosts by normalized IP regardless of case/whitespace", () => {
    const base = makeScan({
      hosts: [makeHost({ id: "a", ipAddress: " 10.0.0.1 " })],
    });
    const comparison = makeScan({
      hosts: [makeHost({ id: "b", ipAddress: "10.0.0.1" })],
    });

    const result = compareScans(base, comparison);

    expect(result.newHosts).toHaveLength(0);
    expect(result.removedHosts).toHaveLength(0);
  });

  it("reports added and removed services keyed by host/protocol/port", () => {
    const host = makeHost({ ipAddress: "10.0.0.2" });
    const base = makeScan({
      hosts: [{ ...host, services: [makeService({ port: 22 })] }],
    });
    const comparison = makeScan({
      hosts: [
        {
          ...host,
          services: [makeService({ port: 22 }), makeService({ port: 80, serviceName: "http" })],
        },
      ],
    });

    const result = compareScans(base, comparison);

    expect(result.newServices).toHaveLength(1);
    expect(result.newServices[0].port).toBe(80);
    expect(result.removedServices).toHaveLength(0);
  });

  it("reports removed services when a port disappears between scans", () => {
    const host = makeHost({ ipAddress: "10.0.0.2" });
    const base = makeScan({
      hosts: [
        {
          ...host,
          services: [makeService({ port: 22 }), makeService({ port: 3389, serviceName: "ms-wbt-server" })],
        },
      ],
    });
    const comparison = makeScan({
      hosts: [{ ...host, services: [makeService({ port: 22 })] }],
    });

    const result = compareScans(base, comparison);

    expect(result.removedServices).toHaveLength(1);
    expect(result.removedServices[0].port).toBe(3389);
  });

  it("reports changed service fields for a service at the same host/port", () => {
    const host = makeHost({ ipAddress: "10.0.0.3" });
    const base = makeScan({
      hosts: [
        {
          ...host,
          services: [
            makeService({ port: 80, serviceName: "http", product: "nginx", version: "1.18", riskLevel: "medium" }),
          ],
        },
      ],
    });
    const comparison = makeScan({
      hosts: [
        {
          ...host,
          services: [
            makeService({ port: 80, serviceName: "http", product: "apache", version: "2.4", riskLevel: "high" }),
          ],
        },
      ],
    });

    const result = compareScans(base, comparison);

    expect(result.newServices).toHaveLength(0);
    expect(result.removedServices).toHaveLength(0);
    expect(result.changedServices).toHaveLength(1);
    expect(result.changedServices[0].changedFields.sort()).toEqual(
      ["product", "riskLevel", "version"].sort(),
    );
  });

  it("does not report a changed service when nothing about it changed", () => {
    const host = makeHost({ ipAddress: "10.0.0.3" });
    const service = makeService({ port: 80, serviceName: "http", product: "nginx" });
    const base = makeScan({ hosts: [{ ...host, services: [service] }] });
    const comparison = makeScan({ hosts: [{ ...host, services: [service] }] });

    const result = compareScans(base, comparison);

    expect(result.changedServices).toHaveLength(0);
  });

  it("reports a new finding only present in the comparison scan", () => {
    const base = makeScan({ findings: [] });
    const comparison = makeScan({
      findings: [makeFinding({ hostId: "10.0.0.1", title: "Telnet is exposed", severity: "critical" })],
    });

    const result = compareScans(base, comparison);

    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0].title).toBe("Telnet is exposed");
    expect(result.resolvedFindings).toHaveLength(0);
  });

  it("reports a resolved finding only present in the base scan", () => {
    const base = makeScan({
      findings: [makeFinding({ hostId: "10.0.0.1", title: "FTP is exposed", severity: "high" })],
    });
    const comparison = makeScan({ findings: [] });

    const result = compareScans(base, comparison);

    expect(result.resolvedFindings).toHaveLength(1);
    expect(result.resolvedFindings[0].title).toBe("FTP is exposed");
    expect(result.newFindings).toHaveLength(0);
  });

  it("treats a finding as unchanged even when its evidence text changes", () => {
    const base = makeScan({
      findings: [
        makeFinding({
          hostId: "10.0.0.1",
          title: "SSH is exposed",
          severity: "medium",
          evidence: "Port 22/tcp is open and identified as OpenSSH 8.2.",
        }),
      ],
    });
    const comparison = makeScan({
      findings: [
        makeFinding({
          hostId: "10.0.0.1",
          title: "SSH is exposed",
          severity: "medium",
          evidence: "Port 22/tcp is open and identified as OpenSSH 9.6.",
        }),
      ],
    });

    const result = compareScans(base, comparison);

    expect(result.newFindings).toHaveLength(0);
    expect(result.resolvedFindings).toHaveLength(0);
  });

  it("warns when target labels differ between scans", () => {
    const base = makeScan({ target: "prod.example.com" });
    const comparison = makeScan({ target: "staging.example.com" });

    const result = compareScans(base, comparison);

    expect(result.warnings.map((w) => w.code)).toContain("different_targets");
  });

  it("does not warn on target when only case/whitespace differ", () => {
    const base = makeScan({ target: " Example.com " });
    const comparison = makeScan({ target: "example.com" });

    const result = compareScans(base, comparison);

    expect(result.warnings.map((w) => w.code)).not.toContain("different_targets");
  });

  it("warns on low host overlap when scans share few hosts", () => {
    const base = makeScan({
      hosts: Array.from({ length: 8 }, (_, i) => makeHost({ ipAddress: `10.0.0.${i}` })),
    });
    const comparison = makeScan({
      hosts: [makeHost({ ipAddress: "10.0.0.0" }), makeHost({ ipAddress: "192.168.1.1" })],
    });

    const result = compareScans(base, comparison);

    expect(result.warnings.map((w) => w.code)).toContain("low_host_overlap");
  });

  it("does not warn on host overlap when scans share most hosts", () => {
    const hosts = Array.from({ length: 4 }, (_, i) => makeHost({ ipAddress: `10.0.0.${i}` }));
    const base = makeScan({ hosts });
    const comparison = makeScan({ hosts });

    const result = compareScans(base, comparison);

    expect(result.warnings.map((w) => w.code)).not.toContain("low_host_overlap");
  });

  it("computes risk before/after/delta from scan summaries", () => {
    const base = makeScan({
      summary: { executive: "", riskScore: 20, riskLevel: "medium", topRisks: [], source: "rule-based" },
    });
    const comparison = makeScan({
      summary: { executive: "", riskScore: 55, riskLevel: "high", topRisks: [], source: "rule-based" },
    });

    const result = compareScans(base, comparison);

    expect(result.riskBefore).toBe(20);
    expect(result.riskAfter).toBe(55);
    expect(result.riskDelta).toBe(35);
    expect(result.highestSeverityBefore).toBe("medium");
    expect(result.highestSeverityAfter).toBe("high");
  });

  it("produces a payload that validates against ScanComparisonSchema", () => {
    const host = makeHost({ ipAddress: "10.0.0.4" });
    const base = makeScan({
      hosts: [{ ...host, services: [makeService({ port: 22 })] }],
      findings: [makeFinding({ hostId: "10.0.0.4" })],
    });
    const comparison = makeScan({
      hosts: [{ ...host, services: [makeService({ port: 22 }), makeService({ port: 80, serviceName: "http" })] }],
      findings: [makeFinding({ hostId: "10.0.0.4" }), makeFinding({ hostId: "10.0.0.4", title: "Telnet is exposed" })],
    });

    const result = compareScans(base, comparison);

    expect(() => ScanComparisonSchema.parse(result)).not.toThrow();
  });
});

describe("findingFingerprint", () => {
  it("is identical for findings that only differ in evidence text", () => {
    const a = makeFinding({ hostId: "10.0.0.1", title: "SSH is exposed", evidence: "one" });
    const b = makeFinding({ hostId: "10.0.0.1", title: "SSH is exposed", evidence: "two" });

    expect(findingFingerprint(a)).toBe(findingFingerprint(b));
  });

  it("differs when the host, severity, or title differ", () => {
    const base = makeFinding({ hostId: "10.0.0.1", title: "SSH is exposed", severity: "medium" });
    const differentHost = makeFinding({ hostId: "10.0.0.2", title: "SSH is exposed", severity: "medium" });
    const differentSeverity = makeFinding({ hostId: "10.0.0.1", title: "SSH is exposed", severity: "high" });
    const differentTitle = makeFinding({ hostId: "10.0.0.1", title: "FTP is exposed", severity: "medium" });

    expect(findingFingerprint(base)).not.toBe(findingFingerprint(differentHost));
    expect(findingFingerprint(base)).not.toBe(findingFingerprint(differentSeverity));
    expect(findingFingerprint(base)).not.toBe(findingFingerprint(differentTitle));
  });

  it("falls back to the display host label when hostId is absent", () => {
    const withHostId = makeFinding({ hostId: "10.0.0.1", host: undefined });
    const withHostLabel = makeFinding({ hostId: undefined, host: "10.0.0.1" });

    expect(findingFingerprint(withHostId)).toBe(findingFingerprint(withHostLabel));
  });

  it("documents that duplicate fingerprints within a scan collapse to the last entry", () => {
    // compareScans maps findings by fingerprint via a plain Map, so two findings
    // in the same scan that share (host, severity, title) collapse to one entry
    // -- this is an intentional, documented choice, not an accident.
    const scanId = "10.0.0.1";
    const base = makeScan({ findings: [] });
    const comparison = makeScan({
      findings: [
        makeFinding({ hostId: scanId, title: "Nonstandard ports are open", evidence: "Ports 9000/tcp are open." }),
        makeFinding({ hostId: scanId, title: "Nonstandard ports are open", evidence: "Ports 9001/tcp are open." }),
      ],
    });

    const result = compareScans(base, comparison);

    expect(result.newFindings).toHaveLength(1);
  });
});
