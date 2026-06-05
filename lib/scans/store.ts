import "server-only";
import { db } from "@/lib/db";
import type { Scan, AISummary, RemediationPlan } from "@/lib/parser/schema";
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

function toScan(row: ScanRow): Scan {
  const ai = row.aiSummary;

  const summary: AISummary = ai
    ? {
        executive: ai.executive,
        riskScore: ai.riskScore,
        riskLevel: ai.riskLevel as AISummary["riskLevel"],
        topRisks: ai.topRisks as string[],
        remediationPlan: (ai.remediation as RemediationPlan) ?? undefined,
        source: ai.source === "rule_based" ? "rule-based" : "ai",
      }
    : { executive: "", riskScore: 0, riskLevel: "info", topRisks: [], source: "rule-based" };

  return {
    id: row.id,
    filename: row.filename,
    target: row.target,
    uploadedAt: row.uploadedAt.toISOString(),
    parsedAt: row.parsedAt.toISOString(),
    scannedAt: row.scannedAt?.toISOString(),
    hosts: row.hosts.map((h) => ({
      id: h.id,
      ipAddress: h.ipAddress,
      hostname: h.hostname ?? undefined,
      operatingSystem: h.operatingSystem,
      role: h.role,
      internetExposed: h.internetExposed,
      services: h.services.map((s) => ({
        id: s.id,
        port: s.port,
        protocol: s.protocol,
        serviceName: s.serviceName,
        product: s.product ?? undefined,
        version: s.version ?? undefined,
        extrainfo: s.extrainfo ?? undefined,
        riskLevel: s.riskLevel,
      })),
    })),
    findings: row.findings.map((f) => ({
      id: f.id,
      hostId: f.hostId ?? undefined,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
      remediation: f.remediation,
    })),
    summary,
    remediationPlan: (ai?.remediation as RemediationPlan) ?? { source: "rule-based", steps: [] },
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
  const hostRows = scan.hosts.map((h) => ({
    id: h.id,
    scanId: scan.id,
    ipAddress: h.ipAddress,
    hostname: h.hostname ?? null,
    operatingSystem: h.operatingSystem,
    role: h.role,
    internetExposed: h.internetExposed,
  }));

  const serviceRows = scan.hosts.flatMap((h) =>
    h.services.map((s) => ({
      id: s.id,
      hostId: h.id,
      port: s.port,
      protocol: s.protocol as "tcp" | "udp",
      serviceName: s.serviceName,
      product: s.product ?? null,
      version: s.version ?? null,
      extrainfo: s.extrainfo ?? null,
      riskLevel: s.riskLevel,
    })),
  );

  const findingRows = scan.findings.map((f) => ({
    id: f.id,
    scanId: scan.id,
    hostId: f.hostId ?? null,
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
    // AiSummary is not created here — only when the user explicitly
    // requests AI analysis via /api/scan/summarize or /api/scan/remediate.
  });
}

export async function deleteScan(id: string, userId?: string): Promise<void> {
  await db.scan.deleteMany({
    where: userId ? { id, userId } : { id },
  });
}
