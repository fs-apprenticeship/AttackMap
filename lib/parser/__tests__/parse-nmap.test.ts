import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseNmapScan } from '../parse-nmap';
import { ScanSchema, type Scan } from '../schema';

const FIXTURE_NAMES = [
  'simple-web-server',
  'domain-controller',
  'linux-host',
  'web-server',
  'internal-platform',
  'scanme-public-host',
] as const;

function readXml(name: string): string {
  return readFileSync(join(process.cwd(), 'fixtures', 'nmap', `${name}.xml`), 'utf-8');
}

function readExpected(name: string): Scan {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'scans', `${name}.json`), 'utf-8')
  ) as Scan;
}

// Fields that are non-deterministic per run (random id, timestamps). The fixtures
// are regenerated snapshots, so compare everything except these.
function stable(scan: Scan) {
  return {
    filename: scan.filename,
    target: scan.target,
    scannedAt: scan.scannedAt,
    hosts: scan.hosts,
    findings: scan.findings.map((f) => ({
      hostId: f.hostId,
      host: f.host,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
      remediation: f.remediation,
    })),
    summary: scan.summary,
    remediationPlan: scan.remediationPlan,
  };
}

const fixtures = FIXTURE_NAMES.map((name) => ({
  name,
  expected: readExpected(name),
}));

describe.each(fixtures)('$name', ({ name, expected }) => {
  let actual: Scan;

  beforeAll(() => {
    actual = parseNmapScan(readXml(name), `${name}.xml`);
  });

  it('produces a schema-valid scan', () => {
    expect(() => ScanSchema.parse(actual)).not.toThrow();
    expect(actual.id).toMatch(/^scan_[0-9a-f-]{36}$/);
    expect(actual.filename).toBe(`${name}.xml`);
  });

  it('matches the expected snapshot (ignoring volatile ids/timestamps)', () => {
    expect(stable(actual)).toEqual(stable(expected));
  });

  it('summary is rule-based with a valid risk level', () => {
    expect(actual.summary.source).toBe('rule-based');
    expect(['critical', 'high', 'medium', 'low', 'info']).toContain(
      actual.summary.riskLevel,
    );
    expect(actual.summary.riskScore).toBeGreaterThanOrEqual(0);
    expect(actual.summary.riskScore).toBeLessThanOrEqual(100);
  });

  it('every finding has a valid structure', () => {
    for (const f of actual.findings) {
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
      expect(f.title).toBeTruthy();
      expect(f.evidence).toBeTruthy();
      expect(f.remediation).toBeTruthy();
      expect(f.id).toMatch(/^finding_/);
    }
  });
});
