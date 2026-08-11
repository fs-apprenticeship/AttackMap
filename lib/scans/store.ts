import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { buildSummary, buildRemediationPlan } from "@/lib/nmap/parse-nmap";
import type {
  Scan,
  Host,
  DownHost,
  Finding,
  AISummary,
  RemediationPlan,
} from "@/lib/nmap/schema";
import type {
  Scan as ScanModel,
  Host as HostModel,
  Service as ServiceModel,
  Finding as FindingModel,
  AiSummary as AiSummaryModel,
} from "@/lib/generated/prisma/client";

const SCAN_INCLUDE = {
  hosts: { include: { services: true } },
  findings: true,
  aiSummary: true,
} as const;

type ScanRow = ScanModel & {
  hosts: (HostModel & { services: ServiceModel[] })[];
  findings: FindingModel[];
  aiSummary: AiSummaryModel | null;
};

const SCOPE_SEP = "::";
const scopeId = (scanId: string, id: string) => `${scanId}${SCOPE_SEP}${id}`;
const unscopeId = (scanId: string, id: string) => {
  const prefix = `${scanId}${SCOPE_SEP}`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
};

function toScan(row: ScanRow): Scan {
  const hosts: Host[] = row.hosts.map((h) => ({
    id: unscopeId(row.id, h.id),
    ipAddress: h.ipAddress,
    hostname: h.hostname ?? undefined,
    operatingSystem: h.operatingSystem,
    role: h.role,
    internetExposed: h.internetExposed,
    services: h.services.map((s) => ({
      id: unscopeId(row.id, s.id),
      port: s.port,
      protocol: s.protocol,
      serviceName: s.serviceName,
      product: s.product ?? undefined,
      version: s.version ?? undefined,
      extrainfo: s.extrainfo ?? undefined,
      cpe: s.cpe,
      riskLevel: s.riskLevel,
    })),
  }));

  const findings: Finding[] = row.findings.map((f) => ({
    id: f.id,
    hostId: f.hostId ? unscopeId(row.id, f.hostId) : undefined,
    severity: f.severity,
    title: f.title,
    evidence: f.evidence,
    remediation: f.remediation,
  }));

  const ai = row.aiSummary;

  const summary: AISummary =
    ai && ai.source === "ai"
      ? {
          executive: ai.executive,
          riskScore: ai.riskScore,
          riskLevel: ai.riskLevel as AISummary["riskLevel"],
          topRisks: ai.topRisks as string[],
          source: "ai",
        }
      : buildSummary(hosts, findings);

  const remediationPlan: RemediationPlan = ai?.remediation
    ? (ai.remediation as RemediationPlan)
    : buildRemediationPlan(findings);

  return {
    id: row.id,
    filename: row.filename,
    target: row.target,
    uploadedAt: row.uploadedAt.toISOString(),
    parsedAt: row.parsedAt.toISOString(),
    scannedAt: row.scannedAt?.toISOString(),
    hosts,
    downHosts: (row.downHosts as DownHost[] | null) ?? [],
    findings,
    summary,
    remediationPlan,
  };
}

export async function listScans(userId?: string): Promise<Scan[]> {
  const rows = await db.scan.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { uploadedAt: "desc" },
    include: SCAN_INCLUDE,
  });
  return rows.map(toScan);
}

export async function getScan(id: string, userId?: string): Promise<Scan | undefined> {
  const row = await db.scan.findFirst({
    where: userId ? { id, userId } : { id },
    include: SCAN_INCLUDE,
  });
  return row ? toScan(row) : undefined;
}

// Scans sharing a `target` string are treated as repeat scans of the same
// asset (see parseNmapScanFromParsed: target is the first host's hostname or
// IP), so this is what powers the risk-over-time trend. Oldest first, so
// callers can plot/derive deltas in chronological order without re-sorting.
export async function listScansForTarget(
  target: string,
  userId?: string,
): Promise<Scan[]> {
  const rows = await db.scan.findMany({
    where: userId ? { target, userId } : { target },
    orderBy: { uploadedAt: "asc" },
    include: SCAN_INCLUDE,
  });
  return rows.map(toScan);
}

async function assertOwnership(scanId: string, userId?: string): Promise<void> {
  if (!userId) return;
  const existing = await db.scan.findUnique({
    where: { id: scanId },
    select: { userId: true },
  });
  if (existing?.userId && existing.userId !== userId) {
    throw new Error("Cannot save a scan that belongs to another user.");
  }
}

function buildScanRows(scan: Scan) {
  const hostRows = scan.hosts.map((h) => ({
    id: scopeId(scan.id, h.id),
    scanId: scan.id,
    ipAddress: h.ipAddress,
    hostname: h.hostname ?? null,
    operatingSystem: h.operatingSystem,
    role: h.role,
    internetExposed: h.internetExposed,
  }));

  const serviceRows = scan.hosts.flatMap((h) =>
    h.services.map((s) => ({
      id: scopeId(scan.id, s.id),
      hostId: scopeId(scan.id, h.id),
      port: s.port,
      protocol: s.protocol as "tcp" | "udp",
      serviceName: s.serviceName,
      product: s.product ?? null,
      version: s.version ?? null,
      extrainfo: s.extrainfo ?? null,
      cpe: s.cpe,
      riskLevel: s.riskLevel,
    })),
  );

  const findingRows = scan.findings.map((f) => ({
    id: f.id,
    scanId: scan.id,
    hostId: f.hostId ? scopeId(scan.id, f.hostId) : null,
    severity: f.severity,
    title: f.title,
    evidence: f.evidence,
    remediation: f.remediation,
  }));

  return { hostRows, serviceRows, findingRows };
}

type HostRow = ReturnType<typeof buildScanRows>["hostRows"][number];
type ServiceRow = ReturnType<typeof buildScanRows>["serviceRows"][number];
type FindingRow = ReturnType<typeof buildScanRows>["findingRows"][number];

function scanUpsertArgs(scan: Scan, userId?: string) {
  return {
    where: { id: scan.id },
    update: {
      filename: scan.filename,
      target: scan.target,
      scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : null,
      parsedAt: new Date(scan.parsedAt),
      downHosts: scan.downHosts,
      ...(userId ? { userId } : {}),
    },
    create: {
      id: scan.id,
      userId: userId ?? null,
      filename: scan.filename,
      target: scan.target,
      scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : null,
      uploadedAt: new Date(scan.uploadedAt),
      parsedAt: new Date(scan.parsedAt),
      downHosts: scan.downHosts,
    },
  } as const;
}

function aiSummaryUpsertArgs(scan: Scan) {
  const hasAiSummary = scan.summary.source === "ai";
  const hasAiRemediation = scan.remediationPlan.source === "ai";
  if (!hasAiSummary && !hasAiRemediation) return null;

  const data = {
    executive: scan.summary.executive,
    riskScore: scan.summary.riskScore,
    riskLevel: scan.summary.riskLevel,
    topRisks: scan.summary.topRisks,
    remediation: hasAiRemediation ? scan.remediationPlan : undefined,
    source: (hasAiSummary ? "ai" : "rule_based") as "ai" | "rule_based",
  };
  return {
    where: { scanId: scan.id },
    update: data,
    create: { scanId: scan.id, ...data },
  } as const;
}

const UPSERT_CHUNK_SIZE = 750;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function upsertHostsChunk(
  tx: Prisma.TransactionClient,
  rows: HostRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await tx.$executeRaw`
    INSERT INTO hosts (id, scan_id, ip_address, hostname, operating_system, role, internet_exposed)
    VALUES ${Prisma.join(
      rows.map(
        (h) =>
          Prisma.sql`(${h.id}, ${h.scanId}, ${h.ipAddress}, ${h.hostname}, ${h.operatingSystem}, ${h.role}, ${h.internetExposed})`,
      ),
    )}
    ON CONFLICT (id) DO UPDATE SET
      ip_address = EXCLUDED.ip_address,
      hostname = EXCLUDED.hostname,
      operating_system = EXCLUDED.operating_system,
      role = EXCLUDED.role,
      internet_exposed = EXCLUDED.internet_exposed
  `;
}

async function upsertServicesChunk(
  tx: Prisma.TransactionClient,
  rows: ServiceRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await tx.$executeRaw`
    INSERT INTO services (id, host_id, port, protocol, service_name, product, version, extrainfo, cpe, risk_level)
    VALUES ${Prisma.join(
      rows.map(
        (s) =>
          Prisma.sql`(${s.id}, ${s.hostId}, ${s.port}, ${s.protocol}::"Protocol", ${s.serviceName}, ${s.product}, ${s.version}, ${s.extrainfo}, ${s.cpe}, ${s.riskLevel}::"RiskLevel")`,
      ),
    )}
    ON CONFLICT (id) DO UPDATE SET
      port = EXCLUDED.port,
      protocol = EXCLUDED.protocol,
      service_name = EXCLUDED.service_name,
      product = EXCLUDED.product,
      version = EXCLUDED.version,
      extrainfo = EXCLUDED.extrainfo,
      cpe = EXCLUDED.cpe,
      risk_level = EXCLUDED.risk_level
  `;
}

async function upsertFindingsChunk(
  tx: Prisma.TransactionClient,
  rows: FindingRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await tx.$executeRaw`
    INSERT INTO findings (id, scan_id, host_id, severity, title, evidence, remediation)
    VALUES ${Prisma.join(
      rows.map(
        (f) =>
          Prisma.sql`(${f.id}, ${f.scanId}, ${f.hostId}, ${f.severity}::"RiskLevel", ${f.title}, ${f.evidence}, ${f.remediation})`,
      ),
    )}
    ON CONFLICT (scan_id, host_id, severity, title) DO UPDATE SET
      id = EXCLUDED.id,
      evidence = EXCLUDED.evidence,
      remediation = EXCLUDED.remediation
  `;
}

export async function saveScanChunked(scan: Scan, userId?: string): Promise<void> {
  await assertOwnership(scan.id, userId);
  const { hostRows, serviceRows, findingRows } = buildScanRows(scan);

  await db.$transaction(
    async (tx) => {
      await tx.scan.upsert(scanUpsertArgs(scan, userId));

      for (const rows of chunk(hostRows, UPSERT_CHUNK_SIZE)) {
        await upsertHostsChunk(tx, rows);
      }
      for (const rows of chunk(serviceRows, UPSERT_CHUNK_SIZE)) {
        await upsertServicesChunk(tx, rows);
      }
      for (const rows of chunk(findingRows, UPSERT_CHUNK_SIZE)) {
        await upsertFindingsChunk(tx, rows);
      }

      await tx.host.deleteMany({
        where: { scanId: scan.id, id: { notIn: hostRows.map((h) => h.id) } },
      });
      await tx.finding.deleteMany({
        where: { scanId: scan.id, id: { notIn: findingRows.map((f) => f.id) } },
      });

      const aiSummaryArgs = aiSummaryUpsertArgs(scan);
      if (aiSummaryArgs) {
        await tx.aiSummary.upsert(aiSummaryArgs);
      }
    },
    { timeout: 120_000 },
  );
}

export async function deleteScan(id: string, userId?: string): Promise<void> {
  await db.scan.deleteMany({
    where: userId ? { id, userId } : { id },
  });
}
