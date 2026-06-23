import "server-only";
import { db } from "@/lib/db";
import { buildSummary, buildRemediationPlan } from "@/lib/parser/parse-nmap";
import type {
  Scan,
  Host,
  Finding,
  AISummary,
  RemediationPlan,
} from "@/lib/parser/schema";
import type {
  Scan as ScanModel,
  Host as HostModel,
  Service as ServiceModel,
  Finding as FindingModel,
  AiSummary as AiSummaryModel,
} from "@/app/generated/prisma/client";

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

export async function saveScan(scan: Scan, userId?: string): Promise<void> {
  // Ownership guard. The scan upsert keys on id alone, so without this a signed
  // in user who knows another user's scan id could overwrite (and re-own) it.
  // Refuse to save over a scan that belongs to a different user; a brand-new
  // scan (no existing row) and the owner's own scan both pass.
  if (userId) {
    const existing = await db.scan.findUnique({
      where: { id: scan.id },
      select: { userId: true },
    });
    if (existing?.userId && existing.userId !== userId) {
      throw new Error("Cannot save a scan that belongs to another user.");
    }
  }

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

  await db.$transaction(async (tx) => {
    await tx.scan.upsert({
      where: { id: scan.id },
      update: {
        filename: scan.filename,
        target: scan.target,
        scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : null,
        parsedAt: new Date(scan.parsedAt),
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
      },
    });

    await tx.host.deleteMany({ where: { scanId: scan.id } });
    await tx.finding.deleteMany({ where: { scanId: scan.id } });
    await tx.host.createMany({ data: hostRows });
    await tx.service.createMany({ data: serviceRows });
    await tx.finding.createMany({ data: findingRows });

    // AiSummary holds ONLY AI output. The rule-based summary/remediation are
    // recomputed on read (see toScan), so a plain upload writes no AiSummary
    // row. We persist one only once the user has generated AI content — an AI
    // summary, an AI remediation plan, or both.
    const hasAiSummary = scan.summary.source === "ai";
    const hasAiRemediation = scan.remediationPlan.source === "ai";
    if (hasAiSummary || hasAiRemediation) {
      const aiSummaryData = {
        executive: scan.summary.executive,
        riskScore: scan.summary.riskScore,
        riskLevel: scan.summary.riskLevel,
        topRisks: scan.summary.topRisks,
        // Store the remediation plan only when it's the AI one; otherwise leave
        // it null so the rule-based plan stays derived-on-read.
        remediation: hasAiRemediation ? scan.remediationPlan : undefined,
        source: (hasAiSummary ? "ai" : "rule_based") as "ai" | "rule_based",
      };
      await tx.aiSummary.upsert({
        where: { scanId: scan.id },
        update: aiSummaryData,
        create: { scanId: scan.id, ...aiSummaryData },
      });
    }
  });
}

export async function deleteScan(id: string, userId?: string): Promise<void> {
  await db.scan.deleteMany({
    where: userId ? { id, userId } : { id },
  });
}
