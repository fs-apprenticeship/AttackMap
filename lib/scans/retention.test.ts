import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: vi.fn(),
    scanImportJob: { deleteMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { runRetentionSweep } from "./retention";

const NOW = new Date("2026-08-04T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { attackMapLastRetentionSweepAt?: number }).attackMapLastRetentionSweepAt = 0;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(db.$executeRaw).mockResolvedValue(0);
  vi.mocked(db.scanImportJob.deleteMany).mockResolvedValue({ count: 0 } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runRetentionSweep", () => {
  it("deletes orphaned upload chunks older than the retention window", async () => {
    vi.mocked(db.$executeRaw).mockResolvedValue(3);

    const result = await runRetentionSweep();

    expect(result).toEqual({ orphanedChunksDeleted: 3, terminalJobsDeleted: 0, throttled: false });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("deletes terminal import jobs older than the retention window", async () => {
    vi.mocked(db.scanImportJob.deleteMany).mockResolvedValue({ count: 5 } as never);

    const result = await runRetentionSweep();

    expect(result).toEqual({ orphanedChunksDeleted: 0, terminalJobsDeleted: 5, throttled: false });
    expect(db.scanImportJob.deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["complete", "failed"] },
        updatedAt: { lt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
  });

  it("throttles back-to-back sweeps within the minimum interval", async () => {
    const first = await runRetentionSweep();
    expect(first.throttled).toBe(false);

    const second = await runRetentionSweep();
    expect(second).toEqual({ orphanedChunksDeleted: 0, terminalJobsDeleted: 0, throttled: true });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.scanImportJob.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("runs again once the throttle interval has fully elapsed", async () => {
    await runRetentionSweep();

    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    const second = await runRetentionSweep();

    expect(second.throttled).toBe(false);
    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
