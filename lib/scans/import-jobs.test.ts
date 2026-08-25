import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    scanUploadChunk: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    scanImportJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    scan: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/scans/cache", () => ({
  invalidateScansCache: vi.fn(),
}));

vi.mock("@/lib/scans/store", () => ({
  saveScanChunked: vi.fn(),
}));

vi.mock("@/lib/nmap/parse-nmap", () => ({
  parseNmapScanFromParsed: vi.fn(),
}));

vi.mock("@/lib/nmap/upload-validation", () => ({
  parseValidatedNmapXmlText: vi.fn(),
}));

vi.mock("@/lib/observability/capture-sanitized-exception", () => ({
  captureSanitizedException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

import { db } from "@/lib/db";
import { invalidateScansCache } from "@/lib/scans/cache";
import { saveScanChunked } from "@/lib/scans/store";
import { parseNmapScanFromParsed } from "@/lib/nmap/parse-nmap";
import { parseValidatedNmapXmlText } from "@/lib/nmap/upload-validation";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";
import * as Sentry from "@sentry/nextjs";
import {
  MAX_ATTEMPTS,
  failStaleJob,
  findStaleImportJobs,
  processScanImportJob,
  reconcileJobIfStale,
  runReconciliationSweep,
} from "./import-jobs";

const dbMock = vi.mocked(db, true);

// Prisma's fluent-client method signatures (PrismaPromise, relation clients)
// don't unify with a plain async mockImplementation. This narrows just enough
// to call mockImplementation with a typed `args`, without `any`.
type MockImpl<Args> = { mockImplementation: (fn: (args: Args) => Promise<unknown>) => void };
function mockImpl<Args>(fn: unknown): MockImpl<Args> {
  return fn as unknown as MockImpl<Args>;
}

const NOW = new Date("2026-08-04T12:00:00.000Z");
const STALE = new Date("2026-08-04T11:50:00.000Z"); // 10 min ago, past STALE_THRESHOLD_MS (6 min)

function makeJobRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job_1",
    userId: "user_1",
    filename: "scan.xml",
    uploadId: "upload_1",
    status: "queued",
    scanId: null,
    errorCode: null,
    errorMessage: null,
    attempts: 0,
    startedAt: null,
    createdAt: STALE,
    updatedAt: STALE,
    ...overrides,
  };
}

const SCAN = {
  id: "scan_abc",
  filename: "scan.xml",
  target: "10.0.0.1",
  uploadedAt: NOW.toISOString(),
  parsedAt: NOW.toISOString(),
  hosts: [],
  downHosts: [],
  findings: [],
  summary: {
    executive: "",
    riskScore: 0,
    riskLevel: "info",
    topRisks: [],
    source: "rule-based",
  },
  remediationPlan: { source: "rule-based", steps: [] },
};

/** Wires the happy-path mocks so processScanImportJob(jobId) runs end to end successfully. */
function mockHappyPath(job: ReturnType<typeof makeJobRow>) {
  dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);
  dbMock.scanImportJob.updateMany.mockResolvedValue({ count: 1 } as never);
  dbMock.scanImportJob.update.mockResolvedValue(job as never);
  dbMock.scanUploadChunk.findMany.mockResolvedValue([
    { chunkIndex: 0, data: Buffer.from("<nmaprun></nmaprun>") },
  ] as never);
  dbMock.scanUploadChunk.deleteMany.mockResolvedValue({ count: 1 } as never);
  vi.mocked(parseValidatedNmapXmlText).mockReturnValue({ ok: true, raw: {} } as never);
  vi.mocked(parseNmapScanFromParsed).mockReturnValue(SCAN as never);
  vi.mocked(saveScanChunked).mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the module-level reconciliation-sweep throttle between tests.
  (globalThis as { attackMapLastReconcileSweepAt?: number }).attackMapLastReconcileSweepAt = 0;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("processScanImportJob", () => {
  it("claims a queued job and runs it through to completion", async () => {
    const job = makeJobRow();
    mockHappyPath(job);

    await processScanImportJob("job_1");

    expect(dbMock.scanImportJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job_1", status: "queued", updatedAt: job.updatedAt },
        data: expect.objectContaining({ status: "validating", attempts: { increment: 1 } }),
      }),
    );
    expect(saveScanChunked).toHaveBeenCalledWith(SCAN, "user_1");
    expect(dbMock.scanImportJob.update).toHaveBeenLastCalledWith({
      where: { id: "job_1" },
      data: { status: "complete", scanId: SCAN.id, completedAt: NOW },
    });
    expect(dbMock.scanUploadChunk.deleteMany).toHaveBeenCalledWith({
      where: { uploadId: "upload_1" },
    });
    expect(invalidateScansCache).toHaveBeenCalledWith("user_1");
  });

  it("no-ops when the claim races against another worker (updateMany.count === 0)", async () => {
    const job = makeJobRow();
    dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);
    dbMock.scanImportJob.updateMany.mockResolvedValue({ count: 0 } as never);

    await processScanImportJob("job_1");

    expect(dbMock.scanUploadChunk.findMany).not.toHaveBeenCalled();
    expect(saveScanChunked).not.toHaveBeenCalled();
  });

  it("no-ops when the job is already terminal", async () => {
    const job = makeJobRow({ status: "complete" });
    dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);

    await processScanImportJob("job_1");

    expect(dbMock.scanImportJob.updateMany).not.toHaveBeenCalled();
  });

  it("deletes a previously-created scan row before reprocessing a retried job", async () => {
    const job = makeJobRow({ scanId: "scan_old" });
    mockHappyPath(job);

    await processScanImportJob("job_1");

    expect(dbMock.scan.deleteMany).toHaveBeenCalledWith({ where: { id: "scan_old" } });
  });

  it("fails a non-retryable validation error immediately, on the first attempt", async () => {
    const job = makeJobRow({ attempts: 0 });
    dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);
    dbMock.scanImportJob.updateMany.mockResolvedValue({ count: 1 } as never);
    dbMock.scanImportJob.update.mockResolvedValue(job as never);
    dbMock.scanUploadChunk.findMany.mockResolvedValue([
      { chunkIndex: 0, data: Buffer.from("not xml") },
    ] as never);
    dbMock.scanUploadChunk.deleteMany.mockResolvedValue({ count: 1 } as never);
    vi.mocked(parseValidatedNmapXmlText).mockReturnValue({
      ok: false,
      issue: { code: "invalid_xml", message: "Scan file is not valid XML." },
    } as never);

    await processScanImportJob("job_1");

    expect(dbMock.scanImportJob.update).toHaveBeenLastCalledWith({
      where: { id: "job_1" },
      data: {
        status: "failed",
        errorCode: "invalid_xml",
        errorMessage: "Scan file is not valid XML.",
      },
    });
    expect(captureSanitizedException).toHaveBeenCalledWith(
      expect.any(Error),
      "Scan import job failed.",
      { operation: "scan_import", errorCode: "invalid_xml" },
    );
    expect(dbMock.scanUploadChunk.deleteMany).toHaveBeenCalledWith({
      where: { uploadId: "upload_1" },
    });
  });

  it("re-throws a transient error while retry budget remains, without failing the job", async () => {
    const job = makeJobRow({ attempts: 0 }); // attempts+1 (1) < MAX_ATTEMPTS (2)
    dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);
    dbMock.scanImportJob.updateMany.mockResolvedValue({ count: 1 } as never);
    dbMock.scanImportJob.update.mockResolvedValue(job as never);
    dbMock.scanUploadChunk.findMany.mockRejectedValue(new Error("db connection dropped"));

    await expect(processScanImportJob("job_1")).rejects.toThrow("db connection dropped");

    expect(captureSanitizedException).not.toHaveBeenCalled();
    expect(dbMock.scanImportJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("fails the job once the retry budget is exhausted on a transient error", async () => {
    const job = makeJobRow({ attempts: MAX_ATTEMPTS - 1 }); // attempts+1 === MAX_ATTEMPTS
    dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);
    dbMock.scanImportJob.updateMany.mockResolvedValue({ count: 1 } as never);
    dbMock.scanImportJob.update.mockResolvedValue(job as never);
    dbMock.scanUploadChunk.deleteMany.mockResolvedValue({ count: 1 } as never);
    dbMock.scanUploadChunk.findMany.mockRejectedValue(new Error("db connection dropped"));

    await processScanImportJob("job_1");

    expect(dbMock.scanImportJob.update).toHaveBeenLastCalledWith({
      where: { id: "job_1" },
      data: {
        status: "failed",
        errorCode: "import_failed",
        errorMessage: "db connection dropped",
      },
    });
    expect(captureSanitizedException).toHaveBeenCalledWith(
      expect.any(Error),
      "Scan import job failed.",
      { operation: "scan_import", errorCode: "import_failed" },
    );
  });
});

describe("findStaleImportJobs", () => {
  it("queries only non-terminal jobs past the stale threshold", async () => {
    dbMock.scanImportJob.findMany.mockResolvedValue([{ id: "job_1", attempts: 0 }] as never);

    const result = await findStaleImportJobs();

    expect(result).toEqual([{ id: "job_1", attempts: 0 }]);
    expect(dbMock.scanImportJob.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["queued", "validating", "parsing", "saving"] },
        updatedAt: { lt: new Date(NOW.getTime() - 6 * 60 * 1000) },
      },
      select: { id: true, attempts: true },
    });
  });
});

describe("reconcileJobIfStale", () => {
  it("does nothing when the job isn't stale (or doesn't belong to the user)", async () => {
    dbMock.scanImportJob.findFirst.mockResolvedValue(null);

    await reconcileJobIfStale("job_1", "user_1");

    expect(dbMock.scanImportJob.updateMany).not.toHaveBeenCalled();
    expect(dbMock.scanImportJob.findUnique).not.toHaveBeenCalled();
  });

  it("reprocesses a stale job that still has retry budget remaining", async () => {
    dbMock.scanImportJob.findFirst.mockResolvedValue({ id: "job_1", attempts: 0 } as never);
    const job = makeJobRow({ attempts: 0 });
    mockHappyPath(job);

    await reconcileJobIfStale("job_1", "user_1");

    expect(dbMock.scanImportJob.update).toHaveBeenLastCalledWith({
      where: { id: "job_1" },
      data: { status: "complete", scanId: SCAN.id, completedAt: NOW },
    });
  });

  it("marks a stale job failed once its retry budget is exhausted", async () => {
    dbMock.scanImportJob.findFirst.mockResolvedValue({
      id: "job_1",
      attempts: MAX_ATTEMPTS,
    } as never);
    const job = makeJobRow({ attempts: MAX_ATTEMPTS, status: "parsing" });
    dbMock.scanImportJob.findUnique.mockResolvedValue(job as never);
    dbMock.scanImportJob.update.mockResolvedValue(job as never);
    dbMock.scanUploadChunk.deleteMany.mockResolvedValue({ count: 1 } as never);

    await reconcileJobIfStale("job_1", "user_1");

    expect(dbMock.scanImportJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: {
        status: "failed",
        errorCode: "timed_out",
        errorMessage: "Import timed out after repeated attempts.",
      },
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Scan import job timed out after repeated attempts.",
      { level: "warning", tags: { operation: "scan_import", errorCode: "timed_out" } },
    );
    expect(invalidateScansCache).toHaveBeenCalledWith("user_1");
  });
});

describe("failStaleJob", () => {
  it("is a no-op when the job is already terminal", async () => {
    dbMock.scanImportJob.findUnique.mockResolvedValue(makeJobRow({ status: "failed" }) as never);

    await failStaleJob("job_1");

    expect(dbMock.scanImportJob.update).not.toHaveBeenCalled();
  });

  it("is a no-op when the job no longer exists", async () => {
    dbMock.scanImportJob.findUnique.mockResolvedValue(null);

    await failStaleJob("job_1");

    expect(dbMock.scanImportJob.update).not.toHaveBeenCalled();
  });
});

describe("runReconciliationSweep", () => {
  it("throttles back-to-back sweeps within the minimum interval", async () => {
    dbMock.scanImportJob.findMany.mockResolvedValue([]);

    const first = await runReconciliationSweep();
    expect(first).toEqual({ checked: 0, failed: 0, throttled: false });

    const second = await runReconciliationSweep();
    expect(second).toEqual({ checked: 0, failed: 0, throttled: true });
  });

  it("counts a rethrown transient failure as failed without crashing the sweep", async () => {
    dbMock.scanImportJob.findMany.mockResolvedValue([
      { id: "job_a", attempts: 0 },
      { id: "job_b", attempts: 0 },
    ] as never);

    dbMock.scanImportJob.updateMany.mockResolvedValue({ count: 1 } as never);
    dbMock.scanImportJob.update.mockResolvedValue({} as never);

    // job_a succeeds fully; job_b fails to read its uploaded chunks (transient,
    // retry budget remaining) and rethrows, which Promise.allSettled surfaces
    // as a rejection. Give each its own uploadId so the chunk-read mock below
    // can tell them apart.
    mockImpl<{ where: { uploadId: string } }>(dbMock.scanUploadChunk.findMany).mockImplementation(
      async ({ where }) => {
        if (where.uploadId === "job_a") {
          return [{ chunkIndex: 0, data: Buffer.from("<nmaprun></nmaprun>") }];
        }
        throw new Error("transient failure");
      },
    );
    dbMock.scanUploadChunk.deleteMany.mockResolvedValue({ count: 1 } as never);
    vi.mocked(parseValidatedNmapXmlText).mockReturnValue({ ok: true, raw: {} } as never);
    vi.mocked(parseNmapScanFromParsed).mockReturnValue(SCAN as never);
    vi.mocked(saveScanChunked).mockResolvedValue(undefined);

    mockImpl<{ where: { id: string } }>(dbMock.scanImportJob.findUnique).mockImplementation(
      async ({ where }) => {
        if (where.id === "job_a") {
          return makeJobRow({ id: "job_a", attempts: 0, uploadId: "job_a" });
        }
        return makeJobRow({ id: "job_b", attempts: 0, uploadId: "job_b" });
      },
    );

    const result = await runReconciliationSweep();

    expect(result.checked).toBe(2);
    expect(result.failed).toBe(1);
  });
});
