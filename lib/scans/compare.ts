import type { Finding, Host, Scan, Service } from "@/lib/parser/schema";

import {
  ScanComparisonSchema,
  type ChangedService,
  type ComparisonFinding,
  type ComparisonHost,
  type ComparisonService,
  type ComparisonWarning,
  type ScanComparison,
} from "./comparison-schema";

const LOW_HOST_OVERLAP_THRESHOLD = 0.25;

export function compareScans(base: Scan, comparison: Scan): ScanComparison {
  const baseHosts = mapBy(base.hosts, hostKey);
  const comparisonHosts = mapBy(comparison.hosts, hostKey);
  const baseServices = serviceMap(base);
  const comparisonServices = serviceMap(comparison);
  const baseFindings = mapBy(base.findings, findingFingerprint);
  const comparisonFindings = mapBy(comparison.findings, findingFingerprint);

  const result: ScanComparison = {
    baseScanId: base.id,
    comparisonScanId: comparison.id,
    baseTarget: base.target,
    comparisonTarget: comparison.target,
    warnings: comparisonWarnings(base, comparison, baseHosts, comparisonHosts),
    riskDelta: comparison.summary.riskScore - base.summary.riskScore,
    riskBefore: base.summary.riskScore,
    riskAfter: comparison.summary.riskScore,
    highestSeverityBefore: base.summary.riskLevel,
    highestSeverityAfter: comparison.summary.riskLevel,
    newHosts: diffAdded(baseHosts, comparisonHosts).map(toComparisonHost),
    removedHosts: diffRemoved(baseHosts, comparisonHosts).map(toComparisonHost),
    newServices: diffAdded(baseServices, comparisonServices).map(({ host, service }) =>
      toComparisonService(host, service),
    ),
    removedServices: diffRemoved(baseServices, comparisonServices).map(
      ({ host, service }) => toComparisonService(host, service),
    ),
    changedServices: changedServiceDiff(baseServices, comparisonServices),
    newFindings: diffAdded(baseFindings, comparisonFindings).map(
      toComparisonFinding,
    ),
    resolvedFindings: diffRemoved(baseFindings, comparisonFindings).map(
      toComparisonFinding,
    ),
  };

  return ScanComparisonSchema.parse(result);
}

export function hostKey(host: Host): string {
  return host.ipAddress.trim().toLowerCase();
}

export function serviceKey(host: Host, service: Service): string {
  return `${hostKey(host)}:${service.protocol.toLowerCase()}:${service.port}`;
}

// Identity is (host, severity, title) only. Every finding title emitted by
// the parser is a fixed string per finding category (see parse-nmap.ts), so
// title already acts as a stable "finding type" - evidence is left out of the
// key because it carries dynamic, run-specific detail (ports, banners) that
// would otherwise make an unchanged finding look like new+resolved churn.
export function findingFingerprint(finding: Finding): string {
  const host = (finding.hostId ?? finding.host ?? "").trim().toLowerCase();
  return [host, finding.severity, finding.title].join("|").trim().toLowerCase();
}

function comparisonWarnings(
  base: Scan,
  comparison: Scan,
  baseHosts: Map<string, Host>,
  comparisonHosts: Map<string, Host>,
): ComparisonWarning[] {
  const warnings: ComparisonWarning[] = [];

  if (normalizeTarget(base.target) !== normalizeTarget(comparison.target)) {
    warnings.push({
      code: "different_targets",
      severity: "warning",
      message:
        "These scans have different target labels, so the comparison may represent different environments instead of change over time.",
    });
  }

  const overlapRatio = hostOverlapRatio(baseHosts, comparisonHosts);
  if (
    baseHosts.size > 0 &&
    comparisonHosts.size > 0 &&
    overlapRatio < LOW_HOST_OVERLAP_THRESHOLD
  ) {
    warnings.push({
      code: "low_host_overlap",
      severity: "warning",
      message:
        "These scans share very few hosts, so new and removed results may mostly reflect different scan scopes.",
    });
  }

  return warnings;
}

function hostOverlapRatio(
  baseHosts: Map<string, Host>,
  comparisonHosts: Map<string, Host>,
): number {
  const uniqueHosts = new Set([...baseHosts.keys(), ...comparisonHosts.keys()]);
  if (uniqueHosts.size === 0) return 1;

  let shared = 0;
  for (const key of baseHosts.keys()) {
    if (comparisonHosts.has(key)) shared += 1;
  }

  return shared / uniqueHosts.size;
}

function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
}

function changedServiceDiff(
  before: Map<string, { host: Host; service: Service }>,
  after: Map<string, { host: Host; service: Service }>,
): ChangedService[] {
  const changed: ChangedService[] = [];

  for (const [key, beforeValue] of before.entries()) {
    const afterValue = after.get(key);
    if (!afterValue) continue;

    const changedFields = serviceChangedFields(
      beforeValue.service,
      afterValue.service,
    );
    if (changedFields.length === 0) continue;

    changed.push({
      hostId: afterValue.host.id,
      hostLabel: hostLabel(afterValue.host),
      port: afterValue.service.port,
      protocol: afterValue.service.protocol,
      before: toComparisonService(beforeValue.host, beforeValue.service),
      after: toComparisonService(afterValue.host, afterValue.service),
      changedFields,
    });
  }

  return changed;
}

function serviceChangedFields(before: Service, after: Service) {
  const fields: Array<"serviceName" | "product" | "version" | "riskLevel"> = [];
  if (before.serviceName !== after.serviceName) fields.push("serviceName");
  if (before.product !== after.product) fields.push("product");
  if (before.version !== after.version) fields.push("version");
  if (before.riskLevel !== after.riskLevel) fields.push("riskLevel");
  return fields;
}

function serviceMap(scan: Scan) {
  const entries = scan.hosts.flatMap((host) =>
    host.services.map((service) => [
      serviceKey(host, service),
      { host, service },
    ] as const),
  );
  return new Map(entries);
}

function toComparisonHost(host: Host): ComparisonHost {
  return {
    id: host.id,
    ipAddress: host.ipAddress,
    hostname: host.hostname,
    operatingSystem: host.operatingSystem,
    role: host.role,
    internetExposed: host.internetExposed,
    serviceCount: host.services.length,
  };
}

function toComparisonService(
  host: Host,
  service: Service,
): ComparisonService {
  return {
    hostId: host.id,
    hostLabel: hostLabel(host),
    port: service.port,
    protocol: service.protocol,
    serviceName: service.serviceName,
    product: service.product,
    version: service.version,
    riskLevel: service.riskLevel,
  };
}

function toComparisonFinding(finding: Finding): ComparisonFinding {
  return {
    id: finding.id,
    hostId: finding.hostId,
    host: finding.host,
    severity: finding.severity,
    title: finding.title,
    evidence: finding.evidence,
  };
}

function hostLabel(host: Host): string {
  return host.hostname ?? host.ipAddress;
}

function mapBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [keyFn(item), item]));
}

function diffAdded<T>(before: Map<string, T>, after: Map<string, T>): T[] {
  return [...after.entries()]
    .filter(([key]) => !before.has(key))
    .map(([, value]) => value);
}

function diffRemoved<T>(before: Map<string, T>, after: Map<string, T>): T[] {
  return [...before.entries()]
    .filter(([key]) => !after.has(key))
    .map(([, value]) => value);
}
