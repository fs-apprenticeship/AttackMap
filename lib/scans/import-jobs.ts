import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { invalidateScansCache } from "@/lib/scans/cache";
import { saveScanChunked } from "@/lib/scans/store";
import { parseNmapScanFromParsed } from "@/lib/nmap/parse-nmap";
import { parseValidatedNmapXmlText } from "@/lib/nmap/upload-validation";
import { MAX_LARGE_SCAN_UPLOAD_BYTES } from "@/lib/nmap/upload-validation-config";
import type { ScanImportStatus as ScanImportStatusModel } from "@/lib/generated/prisma/client";

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

// A job stuck in a non-terminal status this long without an update is
// assumed dead (the `after()` invocation that owned it crashed, was killed
// by maxDuration, or never ran). Set comfortably above maxDuration (300s, see
// app/api/scan/import/route.ts) so a legitimately-still-running "saving"
// step on a large scan — which can hold that status for the whole 300s
// budget without a fresher updatedAt — never gets mistaken for dead and
// reprocessed concurrently by another sweep.
const STALE_THRESHOLD_MS = 6 * 60 * 1000;

// No CRON_SECRET gates the reconciliation endpoint (this deploy has no
// Vercel dashboard access to add one), so it's callable by anyone who knows
// the URL. That's safe by design — it only retries/fails jobs already stuck
// in the DB, using each job's own stored userId; a caller can't target
// arbitrary data through it. The one real risk is compute-cost abuse
// (Hobby's Active CPU budget), so the actual sweep query is throttled here,
// shared across every trigger (piggyback page visits, the GitHub Actions
// schedule, and Vercel's own daily cron) — spamming the endpoint just keeps
// hitting this cheap in-memory check instead of the DB.
const RECONCILE_MIN_INTERVAL_MS = 2 * 60 * 1000;

const NON_TERMINAL_STATUSES: ScanImportStatusModel[] = [
  "queued",
  "validating",
  "parsing",
  "saving",
];
export const MAX_ATTEMPTS = 3;

const globalForReconcile = globalThis as typeof globalThis & {
  attackMapLastReconcileSweepAt?: number;
};

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

// ---------------------------------------------------------------------------
// Chunk transport (replaces Vercel Blob — see app/api/scan/import/chunk/route.ts)
// ---------------------------------------------------------------------------

export async function saveUploadChunk(input: {
  uploadId: string;
  userId: string;
  chunkIndex: number;
  data: Buffer;
}): Promise<void> {
  // Prisma's Bytes field wants a plain Uint8Array<ArrayBuffer>; Buffer's
  // backing ArrayBufferLike can widen to SharedArrayBuffer, which TS rejects
  // here even though it's never actually shared in practice.
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
    throw new Error("Uploaded scan data was not found (chunks may have expired).");
  }
  chunks.forEach((chunk, index) => {
    if (chunk.chunkIndex !== index) {
      throw new Error("Uploaded scan is missing a chunk.");
    }
  });

  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  if (totalBytes > MAX_LARGE_SCAN_UPLOAD_BYTES) {
    throw new Error("Uploaded scan exceeds the large-scan size limit.");
  }

  return Buffer.concat(chunks.map((chunk) => chunk.data)).toString("utf-8");
}

async function deleteUploadChunks(uploadId: string): Promise<void> {
  await db.scanUploadChunk.deleteMany({ where: { uploadId } }).catch(() => {});
}

// Called before creating a job, so a finalize request that races ahead of a
// still-in-flight (or failed) chunk upload gets a clean 400 instead of
// silently processing a truncated file.
export async function countUploadChunks(uploadId: string, userId: string): Promise<number> {
  return db.scanUploadChunk.count({ where: { uploadId, userId } });
}

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

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

/**
 * Runs one processing attempt for a queued/retried import job: reassemble
 * the uploaded chunks, validate, parse, and chunk-upsert into Postgres. Safe
 * to call again for the same job — any Scan row left over from a prior
 * failed attempt is deleted first, since parseNmapScanFromParsed mints a
 * fresh scan.id on every call and would otherwise never revisit (or clean
 * up) it.
 */
export async function processScanImportJob(jobId: string): Promise<void> {
  const job = await db.scanImportJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "complete" || job.status === "failed") return;

  // Optimistic claim: only proceed if the row still matches what we just
  // read (same status + updatedAt). With reconciliation triggered from
  // several places — piggyback page visits, the GitHub Actions sweep, and
  // the daily Vercel cron — two triggers can race to pick up the same stale
  // job. If another one claimed it first, `count` is 0 and we back off
  // instead of double-processing it.
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

  // Any Scan row from a prior attempt is now orphaned — parseNmapScanFromParsed
  // mints a fresh scan.id on every call, so this attempt's writes would never
  // revisit (or clean up) it otherwise. Safe to delete now that we've
  // confirmed (via the claim above) nobody else is mid-attempt on this job.
  if (job.scanId) {
    await db.scan.deleteMany({ where: { id: job.scanId } });
  }

  try {
    const xml = await assembleUploadedXml(job.uploadId, job.userId);

    const validation = parseValidatedNmapXmlText(xml);
    if (!validation.ok) {
      await failJob(jobId, job.userId, validation.issue.code, validation.issue.message);
      await deleteUploadChunks(job.uploadId);
      return;
    }

    await db.scanImportJob.update({ where: { id: jobId }, data: { status: "parsing" } });
    const scan = parseNmapScanFromParsed(validation.raw, job.filename);

    await db.scanImportJob.update({ where: { id: jobId }, data: { status: "saving" } });
    await saveScanChunked(scan, job.userId);

    await db.scanImportJob.update({
      where: { id: jobId },
      data: { status: "complete", scanId: scan.id, completedAt: new Date() },
    });
    await deleteUploadChunks(job.uploadId);
    invalidateScansCache(job.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import scan.";
    if (job.attempts + 1 >= MAX_ATTEMPTS) {
      await failJob(jobId, job.userId, "import_failed", message);
      await deleteUploadChunks(job.uploadId);
    }
    // Otherwise leave status at whatever step it reached — the next
    // reconciliation sweep retries it once updatedAt goes stale.
    throw error;
  }
}

/**
 * Finds stale non-terminal jobs and either retries or fails each one.
 * Shared by every reconciliation trigger: the GitHub Actions schedule
 * (.github/workflows/reconcile-scan-imports.yml), the daily Vercel cron
 * (app/api/cron/reconcile-scan-imports/route.ts), and the piggyback trigger
 * fired from page loads (lib/scans/reconcile-trigger.ts) — one code path so
 * all three stay consistent, and one shared cooldown (see
 * RECONCILE_MIN_INTERVAL_MS) so none of them, individually or combined, can
 * turn into a flood of sweep queries.
 */
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

  const results = await Promise.allSettled(
    staleJobs.map((job) =>
      job.attempts >= MAX_ATTEMPTS
        ? failStaleJob(job.id)
        : processScanImportJob(job.id),
    ),
  );

  return {
    checked: staleJobs.length,
    failed: results.filter((result) => result.status === "rejected").length,
    throttled: false,
  };
}
