import "server-only";

import { db } from "@/lib/db";

// How long a completed/failed import job's tracking row survives before
// cleanup. This only prunes ScanImportJob rows — the Scan/Host/Service/
// Finding data it produced is untouched (ScanImportJob.scanId is SetNull on
// delete in the other direction, not the reverse).
const TERMINAL_JOB_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// How long an upload chunk survives once it's no longer backed by an active
// job. Generous relative to how long a real import ever takes (jobs go
// terminal within ~an hour worst case via the reconciliation sweep's own
// 6-minute stale threshold and 2-attempt budget), so this only ever catches
// genuine orphans: chunks from an upload the user abandoned before starting
// the import, or a rare terminal job whose own best-effort chunk cleanup
// failed.
const ORPHANED_CHUNK_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Both sweeps are cheap but pointless to run on every 10-minute reconcile
// tick, so they're throttled independently and far more loosely.
const RETENTION_SWEEP_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // once/day

const globalForRetention = globalThis as typeof globalThis & {
  attackMapLastRetentionSweepAt?: number;
};

async function deleteOrphanedUploadChunks(cutoff: Date): Promise<number> {
  // A chunk is safe to delete once no ScanImportJob still claims its
  // uploadId in a non-terminal state — whether because no job was ever
  // created for it, or every job that was is already complete/failed. This
  // deliberately does NOT key off the chunk's own age vs. job status alone:
  // a job stuck non-terminal (e.g. reconciliation cron down for a while)
  // must keep its chunks, or a later reconcile would fail with
  // "chunks_missing" trying to reassemble it.
  const result = await db.$executeRaw`
    DELETE FROM scan_upload_chunks c
    WHERE c.created_at < ${cutoff}
      AND NOT EXISTS (
        SELECT 1 FROM scan_import_jobs j
        WHERE j.upload_id = c.upload_id
          AND j.status NOT IN ('complete', 'failed')
      )
  `;
  return result;
}

/**
 * Prune orphaned upload chunks and old terminal import-job rows. Throttled to
 * roughly once a day; safe to call on every reconciliation cron tick.
 */
export async function runRetentionSweep(): Promise<{
  orphanedChunksDeleted: number;
  terminalJobsDeleted: number;
  throttled: boolean;
}> {
  const now = Date.now();
  const lastRun = globalForRetention.attackMapLastRetentionSweepAt ?? 0;
  if (now - lastRun < RETENTION_SWEEP_MIN_INTERVAL_MS) {
    return { orphanedChunksDeleted: 0, terminalJobsDeleted: 0, throttled: true };
  }
  globalForRetention.attackMapLastRetentionSweepAt = now;

  const [orphanedChunksDeleted, terminalJobs] = await Promise.all([
    deleteOrphanedUploadChunks(new Date(now - ORPHANED_CHUNK_RETENTION_MS)),
    db.scanImportJob.deleteMany({
      where: {
        status: { in: ["complete", "failed"] },
        updatedAt: { lt: new Date(now - TERMINAL_JOB_RETENTION_MS) },
      },
    }),
  ]);

  return {
    orphanedChunksDeleted,
    terminalJobsDeleted: terminalJobs.count,
    throttled: false,
  };
}
