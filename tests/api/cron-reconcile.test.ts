import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/scans/import-jobs", () => ({
  runReconciliationSweep: vi.fn(),
}));

vi.mock("@/lib/scans/retention", () => ({
  runRetentionSweep: vi.fn(),
}));

import { GET } from "@/app/api/cron/reconcile-scan-imports/route";
import { runReconciliationSweep } from "@/lib/scans/import-jobs";
import { runRetentionSweep } from "@/lib/scans/retention";

const RECONCILIATION_RESULT = { checked: 2, failed: 0, throttled: false };
const RETENTION_RESULT = { orphanedChunksDeleted: 1, terminalJobsDeleted: 4, throttled: false };

function getRequest(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost/api/cron/reconcile-scan-imports", {
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  vi.mocked(runReconciliationSweep).mockResolvedValue(RECONCILIATION_RESULT);
  vi.mocked(runRetentionSweep).mockResolvedValue(RETENTION_RESULT);
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("GET /api/cron/reconcile-scan-imports", () => {
  it("rejects a request with no bearer token", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(401);
    expect(runReconciliationSweep).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const res = await GET(getRequest("Bearer wrong"));

    expect(res.status).toBe(401);
  });

  it("rejects every request when CRON_SECRET isn't configured, even with a matching-looking header", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(getRequest("Bearer undefined"));

    expect(res.status).toBe(401);
  });

  it("runs both sweeps and returns their combined results", async () => {
    const res = await GET(getRequest("Bearer test-secret"));

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ reconciliation: RECONCILIATION_RESULT, retention: RETENTION_RESULT });
    expect(runReconciliationSweep).toHaveBeenCalledTimes(1);
    expect(runRetentionSweep).toHaveBeenCalledTimes(1);
  });
});
