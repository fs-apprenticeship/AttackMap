import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseNmapScan } from '../parse-nmap';
import type { ParsedScan } from '../schema';


type ExpectedFixture = Omit<ParsedScan, 'hosts' | 'findings'> & {
  ai_summary?: unknown;
  hosts: Array<
    Omit<ParsedScan['hosts'][number], 'services'> & {
      services: Array<
        Omit<ParsedScan['hosts'][number]['services'][number], 'product' | 'version'> & {
          product: string | null;
          version: string | null;
        }
      >;
    }
  >;
  findings: Array<ParsedScan['findings'][number]>;
};

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

function readExpected(name: string): ExpectedFixture {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'scans', `${name}.json`), 'utf-8')
  );
}

// Normalize null → undefined so fixture nulls compare equal to schema optionals
function norm(v: string | null | undefined): string | undefined {
  return v == null ? undefined : v;
}

// Load all fixture data at module level so it.each has access at definition time
const fixtures = FIXTURE_NAMES.map((name) => ({
  name,
  expected: readExpected(name),
}));

// ─── per-fixture test suite ────────────────────────────────────────────────

describe.each(fixtures)('$name', ({ name, expected }) => {
  let actual: ParsedScan;

  beforeAll(() => {
    actual = parseNmapScan(readXml(name), `${name}.xml`);
  });

  // ── Schema ────────────────────────────────────────────────────────────────

  it('passes Zod schema (no throws)', () => {
    expect(actual).toBeDefined();
    expect(actual.id).toMatch(/^scan_[0-9a-f-]{36}$/);
    expect(actual.filename).toBe(`${name}.xml`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  describe('summary', () => {
    it('total_hosts', () => {
      expect(actual.summary.total_hosts).toBe(expected.summary.total_hosts);
    });

    it('open_ports', () => {
      expect(actual.summary.open_ports).toBe(expected.summary.open_ports);
    });

    it('risky_services', () => {
      expect(actual.summary.risky_services).toBe(expected.summary.risky_services);
    });
  });

  // ── Hosts ─────────────────────────────────────────────────────────────────

  describe('hosts', () => {
    it(`has ${expected.hosts.length} host(s)`, () => {
      expect(actual.hosts).toHaveLength(expected.hosts.length);
    });

    it.each(expected.hosts)(
      'host $ip_address — hostname, os, role, internet_exposed',
      (eh) => {
        const ah = actual.hosts.find((h) => h.ip_address === eh.ip_address);
        expect(ah, `host ${eh.ip_address} not found`).toBeDefined();
        expect(ah!.hostname).toBe(norm(eh.hostname));
        expect(ah!.operating_system).toBe(norm(eh.operating_system));
        expect(ah!.role).toBe(norm(eh.role));
        expect(ah!.internet_exposed).toBe(eh.internet_exposed);
      }
    );
  });

  // ── Services ──────────────────────────────────────────────────────────────

  describe('services', () => {
    const cases = expected.hosts.flatMap((eh) =>
      eh.services.map((es) => ({
        ip: eh.ip_address,
        port: es.port,
        expected_service: es,
      }))
    );

    it.each(cases)(
      'host $ip port $port — service_name / product / version / risk_level',
      ({ ip, port, expected_service: es }) => {
        const ah = actual.hosts.find((h) => h.ip_address === ip)!;
        const as_ = ah?.services.find((s) => s.port === port);

        expect(as_, `port ${port} not found on ${ip}`).toBeDefined();
        expect(as_!.service_name).toBe(es.service_name);
        expect(as_!.product).toBe(norm(es.product));
        expect(as_!.version).toBe(norm(es.version));
        expect(as_!.risk_level).toBe(es.risk_level);
      }
    );
  });

  // ── Findings ──────────────────────────────────────────────────────────────

  describe('findings', () => {
    it(`has ${expected.findings.length} finding(s)`, () => {
      expect(actual.findings).toHaveLength(expected.findings.length);
    });

    it('each finding has valid structure and severity', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      for (const f of actual.findings) {
        expect(validSeverities, `invalid severity "${f.severity}"`).toContain(f.severity);
        expect(f.title).toBeTruthy();
        expect(f.evidence).toBeTruthy();
        expect(f.remediation).toBeTruthy();
        expect(f.id).toMatch(/^finding_/);
        expect(f.scan_id).toBe(actual.id);
      }
    });

    it.each(expected.findings)(
      'finding "$title" — severity matches',
      (ef) => {
        const match = actual.findings.find(
          (f) => f.severity === ef.severity && f.title === ef.title
        );
        expect(
          match,
          `no finding with severity="${ef.severity}" title="${ef.title}"`
        ).toBeDefined();
      }
    );
  });
});
