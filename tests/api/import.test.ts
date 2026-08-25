import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => fn() };
});

vi.mock("@/lib/auth/sync", () => ({
  getOptionalAuth: vi.fn(),
}));

vi.mock("@/lib/scans/import-jobs", () => ({
  countUploadChunks: vi.fn(),
  createScanImportJob: vi.fn(),
  getScanImportJob: vi.fn(),
  processScanImportJob: vi.fn(),
  reconcileJobIfStale: vi.fn(),
}));

import { GET, POST } from "@/app/api/scan/import/route";
import { getOptionalAuth } from "@/lib/auth/sync";
import {
  countUploadChunks,
  createScanImportJob,
  getScanImportJob,
  processScanImportJob,
  reconcileJobIfStale,
} from "@/lib/scans/import-jobs";
import { MAX_LARGE_SCAN_UPLOAD_BYTES } from "@/lib/nmap/upload-validation-config";

const JOB = {
  id: "job_1",
  filename: "scan.xml",
  status: "queued" as const,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

function postRequest(body: unknown | string): NextRequest {
  return new NextRequest("http://localhost/api/scan/import", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getRequest(jobId?: string): NextRequest {
  const url = new URL("http://localhost/api/scan/import");
  if (jobId !== undefined) url.searchParams.set("jobId", jobId);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOptionalAuth).mockResolvedValue("user_1");
  // These run inside the route's fire-and-forget `after()` callback, which
  // always attaches a `.catch`, so give them a resolved default even in
  // tests that don't care about their behavior.
  vi.mocked(processScanImportJob).mockResolvedValue(undefined);
  vi.mocked(reconcileJobIfStale).mockResolvedValue(undefined);
});

describe("POST /api/scan/import", () => {
  const validBody = {
    uploadId: "upload_1",
    filename: "scan.xml",
    fileSizeBytes: 1024,
    totalChunks: 1,
  };

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getOptionalAuth).mockResolvedValue(null);

    const res = await POST(postRequest(validBody));

    expect(res.status).toBe(401);
  });

  it("rejects an invalid JSON body", async () => {
    const res = await POST(postRequest("not json"));

    expect(res.status).toBe(400);
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(postRequest({ uploadId: "upload_1" }));

    expect(res.status).toBe(400);
  });

  it("rejects a file over the large-scan size limit", async () => {
    const res = await POST(
      postRequest({ ...validBody, fileSizeBytes: MAX_LARGE_SCAN_UPLOAD_BYTES + 1 }),
    );

    expect(res.status).toBe(413);
  });

  it("rejects when not all chunks have arrived yet", async () => {
    vi.mocked(countUploadChunks).mockResolvedValue(1);

    const res = await POST(postRequest({ ...validBody, totalChunks: 3 }));

    expect(res.status).toBe(409);
  });

  it("creates the job, kicks off processing, and returns 202", async () => {
    vi.mocked(countUploadChunks).mockResolvedValue(1);
    vi.mocked(createScanImportJob).mockResolvedValue(JOB as never);
    vi.mocked(processScanImportJob).mockResolvedValue(undefined);

    const res = await POST(postRequest(validBody));

    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.job).toEqual(JOB);
    expect(createScanImportJob).toHaveBeenCalledWith({
      userId: "user_1",
      filename: validBody.filename,
      fileSizeBytes: validBody.fileSizeBytes,
      uploadId: validBody.uploadId,
    });
    expect(processScanImportJob).toHaveBeenCalledWith(JOB.id);
  });
});

describe("GET /api/scan/import", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(getOptionalAuth).mockResolvedValue(null);

    const res = await GET(getRequest("job_1"));

    expect(res.status).toBe(401);
  });

  it("rejects a request with no jobId", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(400);
  });

  it("returns 404 when the job doesn't exist for this user", async () => {
    vi.mocked(getScanImportJob).mockResolvedValue(undefined);

    const res = await GET(getRequest("missing_job"));

    expect(res.status).toBe(404);
    expect(reconcileJobIfStale).toHaveBeenCalledWith("missing_job", "user_1");
  });

  it("returns the job and reconciles it if stale", async () => {
    vi.mocked(getScanImportJob).mockResolvedValue(JOB as never);

    const res = await GET(getRequest("job_1"));

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.job).toEqual(JOB);
    expect(reconcileJobIfStale).toHaveBeenCalledWith("job_1", "user_1");
  });
});
