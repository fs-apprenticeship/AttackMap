import "server-only";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/lib/db";
import { invalidateScansCache } from "@/lib/scans/cache";
import { saveScanChunked } from "@/lib/scans/store";
import { parseNmapScanFromParsed } from "@/lib/nmap/parse-nmap";
import { parseValidatedNmapXmlText } from "@/lib/nmap/upload-validation";
import { MAX_LARGE_SCAN_UPLOAD_BYTES } from "@/lib/nmap/upload-validation-config";
import type { ScanImportStatus as ScanImportStatusModel } from "@/lib/generated/prisma/client";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";

export const ScanImportJobStatusSchema = z.enum([
  "queued",
  "validating",
  "parsing",
  "saving",
  "complete",
  "failed",
]);

export const ScanImportJobSchema = z.object({
  id: z.string(),
  filename: z.string(),
  status: ScanImportJobStatusSchema,
  scanId: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ScanImportJobStatus = z.infer<typeof ScanImportJobStatusSchema>;
export type ScanImportJob = z.infer<typeof ScanImportJobSchema>;

const STALE_THRESHOLD_MS = 6 * 60 * 1000;

const RECONCILE_MIN_INTERVAL_MS = 2 * 60 * 1000;

const NON_TERMINAL_STATUSES: ScanImportStatusModel[] = [
  "queued",
  "validating",
  "parsing",
  "saving",
];
export const MAX_ATTEMPTS = 2;

const globalForReconcile = globalThis as typeof globalThis & {
  attackMapLastReconcileSweepAt?: number;
};

// Thrown for failures that will reproduce identically on every retry (bad
// upload data, a parser bug on validated input). These reject immediately
// instead of consuming the reconciliation retry budget, which exists to
// recover from the function dying mid-flight, not from deterministic errors.
class NonRetryableImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "NonRetryableImportError";
  }
}

type JobRow = {
  id: string;
  userId: string;
  filename: string;
  uploadId: string;
  status: ScanImportStatusModel;
  scanId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

function toScanImportJob(row: JobRow): ScanImportJob {
  return ScanImportJobSchema.parse({
    id: row.id,
    filename: row.filename,
    status: row.status,
    scanId: row.scanId ?? undefined,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function saveUploadChunk(input: {
  uploadId: string;
  userId: string;
  chunkIndex: number;
  data: Buffer;
}): Promise<void> {
  const data = new Uint8Array(input.data);
  await db.scanUploadChunk.upsert({
    where: { uploadId_chunkIndex: { uploadId: input.uploadId, chunkIndex: input.chunkIndex } },
    update: { data },
    create: { ...input, data },
  });
}

async function assembleUploadedXml(uploadId: string, userId: string): Promise<string> {
  const chunks = await db.scanUploadChunk.findMany({
    where: { uploadId, userId },
    orderBy: { chunkIndex: "asc" },
    select: { chunkIndex: true, data: true },
  });

  if (chunks.length === 0) {
    throw new NonRetryableImportError(
      "chunks_missing",
      "Uploaded scan data was not found (chunks may have expired).",
    );
  }
  chunks.forEach((chunk, index) => {
    if (chunk.chunkIndex !== index) {
      throw new NonRetryableImportError("chunks_missing", "Uploaded scan is missing a chunk.");
    }
  });

  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  if (totalBytes > MAX_LARGE_SCAN_UPLOAD_BYTES) {
    throw new NonRetryableImportError(
      "upload_too_large",
      "Uploaded scan exceeds the large-scan size limit.",
    );
  }

  return Buffer.concat(chunks.map((chunk) => chunk.data)).toString("utf-8");
}

async function deleteUploadChunks(uploadId: string): Promise<void> {
  await db.scanUploadChunk.deleteMany({ where: { uploadId } }).catch(() => {});
}

export async function countUploadChunks(uploadId: string, userId: string): Promise<number> {
  return db.scanUploadChunk.count({ where: { uploadId, userId } });
}

export async function createScanImportJob(input: {
  userId: string;
  filename: string;
  fileSizeBytes: number;
  uploadId: string;
}): Promise<ScanImportJob> {
  const row = await db.scanImportJob.create({ data: input });
  return toScanImportJob(row);
}

export async function getScanImportJob(
  id: string,
  userId: string,
): Promise<ScanImportJob | undefined> {
  const row = await db.scanImportJob.findFirst({ where: { id, userId } });
  return row ? toScanImportJob(row) : undefined;
}

export async function listActiveOrFailedImportJobs(userId: string): Promise<ScanImportJob[]> {
  const rows = await db.scanImportJob.findMany({
    where: { userId, status: { not: "complete" } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map(toScanImportJob);
}

export async function dismissImportJob(id: string, userId: string): Promise<void> {
  await db.scanImportJob.deleteMany({ where: { id, userId } });
}

export async function findStaleImportJobs(): Promise<
  { id: string; attempts: number }[]
> {
  return db.scanImportJob.findMany({
    where: {
      status: { in: NON_TERMINAL_STATUSES },
      updatedAt: { lt: new Date(Date.now() - STALE_THRESHOLD_MS) },
    },
    select: { id: true, attempts: true },
  });
}

async function reconcileStaleJob(job: { id: string; attempts: number }): Promise<void> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await failStaleJob(job.id);
  } else {
    await processScanImportJob(job.id);
  }
}

export async function reconcileJobIfStale(id: string, userId: string): Promise<void> {
  const job = await db.scanImportJob.findFirst({
    where: {
      id,
      userId,
      status: { in: NON_TERMINAL_STATUSES },
      updatedAt: { lt: new Date(Date.now() - STALE_THRESHOLD_MS) },
    },
    select: { id: true, attempts: true },
  });
  if (!job) return;
  await reconcileStaleJob(job);
}

export async function failStaleJob(id: string): Promise<void> {
  const job = await db.scanImportJob.findUnique({ where: { id } });
  if (!job || job.status === "complete" || job.status === "failed") return;

  await db.scanImportJob.update({
    where: { id },
    data: {
      status: "failed",
      errorCode: "timed_out",
      errorMessage: "Import timed out after repeated attempts.",
    },
  });
  await deleteUploadChunks(job.uploadId);
  invalidateScansCache(job.userId);

  // Terminal, actionable outcome: the job exhausted its retry budget without
  // ever completing (e.g. the function died mid-flight repeatedly).
  Sentry.captureMessage("Scan import job timed out after repeated attempts.", {
    level: "warning",
    tags: { operation: "scan_import", errorCode: "timed_out" },
  });
}

async function failJob(
  id: string,
  userId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await db.scanImportJob.update({
    where: { id },
    data: { status: "failed", errorCode, errorMessage },
  });
  invalidateScansCache(userId);
}

export async function processScanImportJob(jobId: string): Promise<void> {
  const job = await db.scanImportJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "complete" || job.status === "failed") return;

  const claim = await db.scanImportJob.updateMany({
    where: { id: jobId, status: job.status, updatedAt: job.updatedAt },
    data: {
      status: "validating",
      attempts: { increment: 1 },
      startedAt: job.startedAt ?? new Date(),
      scanId: null,
      errorCode: null,
      errorMessage: null,
    },
  });
  if (claim.count === 0) return;

  try {
    if (job.scanId) {
      await db.scan.deleteMany({ where: { id: job.scanId } });
    }

    const xml = await assembleUploadedXml(job.uploadId, job.userId);

    const validation = parseValidatedNmapXmlText(xml);
    if (!validation.ok) {
      throw new NonRetryableImportError(validation.issue.code, validation.issue.message);
    }

    await db.scanImportJob.update({ where: { id: jobId }, data: { status: "parsing" } });
    let scan;
    try {
      scan = parseNmapScanFromParsed(validation.raw, job.filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse scan.";
      throw new NonRetryableImportError("parse_failed", message);
    }

    await db.scanImportJob.update({ where: { id: jobId }, data: { status: "saving" } });
    await saveScanChunked(scan, job.userId);

    await db.scanImportJob.update({
      where: { id: jobId },
      data: { status: "complete", scanId: scan.id, completedAt: new Date() },
    });
    await deleteUploadChunks(job.uploadId);
    invalidateScansCache(job.userId);
  } catch (error) {
    const nonRetryable = error instanceof NonRetryableImportError;
    const code = error instanceof NonRetryableImportError ? error.code : "import_failed";
    const message = error instanceof Error ? error.message : "Failed to import scan.";

    if (nonRetryable || job.attempts + 1 >= MAX_ATTEMPTS) {
      // Terminal, actionable outcome — the job will not be retried again.
      // Transient retry-eligible failures (the `throw error` below) are
      // expected operational noise and are intentionally not captured.
      captureSanitizedException(error, "Scan import job failed.", {
        operation: "scan_import",
        errorCode: code,
      });
      await failJob(jobId, job.userId, code, message);
      await deleteUploadChunks(job.uploadId);
      return;
    }
    throw error;
  }
}

export async function runReconciliationSweep(): Promise<{
  checked: number;
  failed: number;
  throttled: boolean;
}> {
  const now = Date.now();
  const lastRun = globalForReconcile.attackMapLastReconcileSweepAt ?? 0;
  if (now - lastRun < RECONCILE_MIN_INTERVAL_MS) {
    return { checked: 0, failed: 0, throttled: true };
  }
  globalForReconcile.attackMapLastReconcileSweepAt = now;

  const staleJobs = await findStaleImportJobs();

  const results = await Promise.allSettled(staleJobs.map(reconcileStaleJob));

  return {
    checked: staleJobs.length,
    failed: results.filter((result) => result.status === "rejected").length,
    throttled: false,
  };
}
