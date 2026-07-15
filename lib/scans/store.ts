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

// ---------------------------------------------------------------------------
// DB → Zod mapping
// ---------------------------------------------------------------------------

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

// Host/Service IDs from the parser are scan-local (a bare IP, or ip:proto:port),
// but Host.id / Service.id are GLOBAL primary keys. Two scans that share an IP
// (a re-scan, or two users scanning the same host) would collide. Namespace the
// IDs by scanId on write and strip the prefix on read, so the DB keys are unique
// while the app keeps working with the original scan-local IDs.
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

  // The rule-based summary and remediation plan are pure functions of the
  // stored hosts/findings, so we recompute them on read rather than storing a
  // baseline. AiSummary holds ONLY AI output and overrides the defaults when
  // present (summary when source is "ai", remediation when an AI plan exists).
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

// Ownership guard. The scan upsert keys on id alone, so without this a signed
// in user who knows another user's scan id could overwrite (and re-own) it.
// Refuse to save over a scan that belongs to a different user; a brand-new
// scan (no existing row) and the owner's own scan both pass.
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

// AiSummary holds ONLY AI output. The rule-based summary/remediation are
// recomputed on read (see toScan), so a plain upload writes no AiSummary
// row. We persist one only once the user has generated AI content — an AI
// summary, an AI remediation plan, or both.
function aiSummaryUpsertArgs(scan: Scan) {
  const hasAiSummary = scan.summary.source === "ai";
  const hasAiRemediation = scan.remediationPlan.source === "ai";
  if (!hasAiSummary && !hasAiRemediation) return null;

  const data = {
    executive: scan.summary.executive,
    riskScore: scan.summary.riskScore,
    riskLevel: scan.summary.riskLevel,
    topRisks: scan.summary.topRisks,
    // Store the remediation plan only when it's the AI one; otherwise leave
    // it null so the rule-based plan stays derived-on-read.
    remediation: hasAiRemediation ? scan.remediationPlan : undefined,
    source: (hasAiSummary ? "ai" : "rule_based") as "ai" | "rule_based",
  };
  return {
    where: { scanId: scan.id },
    update: data,
    create: { scanId: scan.id, ...data },
  } as const;
}

export async function saveScan(scan: Scan, userId?: string): Promise<void> {
  await assertOwnership(scan.id, userId);
  const { hostRows, serviceRows, findingRows } = buildScanRows(scan);

  await db.$transaction(async (tx) => {
    await tx.scan.upsert(scanUpsertArgs(scan, userId));

    await tx.host.deleteMany({ where: { scanId: scan.id } });
    await tx.finding.deleteMany({ where: { scanId: scan.id } });
    await tx.host.createMany({ data: hostRows });
    await tx.service.createMany({ data: serviceRows });
    await tx.finding.createMany({ data: findingRows });

    const aiSummaryArgs = aiSummaryUpsertArgs(scan);
    if (aiSummaryArgs) {
      await tx.aiSummary.upsert(aiSummaryArgs);
    }
  });
}

// ---------------------------------------------------------------------------
// Chunked upsert — large-scan async import path (lib/scans/import-jobs.ts).
// Small scans keep using saveScan's delete + createMany above, unchanged.
//
// A single delete+createMany call puts every row of a scan in one Postgres
// statement with no bound-parameter safeguard; for a scan near
// MAX_NMAP_HOSTS/MAX_NMAP_PORTS that can approach Postgres's ~65,535
// bound-parameter ceiling and holds locks for the whole statement. This
// upserts in fixed-size batches instead, inside one transaction, using
// ON CONFLICT so a retried job (see reconcile-scan-imports) is safe to
// re-run against partially-written data.
// ---------------------------------------------------------------------------

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

      // Remove rows left over from a prior save of this scan.id that this
      // parse no longer produced (e.g. a host that went down between saves).
      // A no-op for the common case (large-scan uploads always parse to a
      // brand-new scan.id), but keeps this correct if it's ever called again
      // for the same scan.id.
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
