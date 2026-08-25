import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    rateLimitBucket: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { RateLimitExceededError, checkRateLimit } from "./rate-limiter";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LIMIT = 5;

function mockBucketCount(count: number) {
  vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({ count } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.rateLimitBucket.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("does not throw when the count is under the limit", async () => {
    mockBucketCount(LIMIT - 1);

    await expect(checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS)).resolves.toBeUndefined();
  });

  it("does not throw when the count exactly equals the limit", async () => {
    mockBucketCount(LIMIT);

    await expect(checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS)).resolves.toBeUndefined();
  });

  it("throws RateLimitExceededError once the count exceeds the limit", async () => {
    mockBucketCount(LIMIT + 1);

    await expect(checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS)).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
  });

  it("reports retryAfterMs as the time remaining until the window rolls over", async () => {
    // Window boundaries fall on exact multiples of WINDOW_MS. Park 10 minutes
    // into a window, so 50 minutes remain until it rolls over.
    const windowStart = 10 * WINDOW_MS;
    const tenMinutesIn = windowStart + 10 * 60 * 1000;
    vi.setSystemTime(tenMinutesIn);
    mockBucketCount(LIMIT + 1);

    await expect(checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS)).rejects.toMatchObject({
      retryAfterMs: 50 * 60 * 1000,
    });
  });

  it("upserts keyed by the floored window start, not the raw timestamp", async () => {
    const windowStart = 3 * WINDOW_MS;
    vi.setSystemTime(windowStart + 12345); // partway through the window
    mockBucketCount(1);

    await checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS);

    expect(db.rateLimitBucket.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_key_windowStart: {
            userId: "user_1",
            key: "scan_chat",
            windowStart: new Date(windowStart),
          },
        },
      }),
    );
  });

  it("scopes the counter to userId and key independently", async () => {
    mockBucketCount(1);

    await checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS);
    await checkRateLimit("user_2", "scan_chat", LIMIT, WINDOW_MS);
    await checkRateLimit("user_1", "scan_summarize", LIMIT, WINDOW_MS);

    const calls = vi.mocked(db.rateLimitBucket.upsert).mock.calls;
    expect(calls[0][0].create).toMatchObject({ userId: "user_1", key: "scan_chat" });
    expect(calls[1][0].create).toMatchObject({ userId: "user_2", key: "scan_chat" });
    expect(calls[2][0].create).toMatchObject({ userId: "user_1", key: "scan_summarize" });
  });

  it("sweeps expired buckets for this user/key when the cleanup roll succeeds", async () => {
    mockBucketCount(1);
    vi.spyOn(Math, "random").mockReturnValue(0); // always below CLEANUP_PROBABILITY

    await checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS);

    expect(db.rateLimitBucket.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1", key: "scan_chat", windowStart: { lt: expect.any(Date) } },
    });
  });

  it("skips cleanup when the cleanup roll fails", async () => {
    mockBucketCount(1);
    vi.spyOn(Math, "random").mockReturnValue(0.99); // always above CLEANUP_PROBABILITY

    await checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS);

    expect(db.rateLimitBucket.deleteMany).not.toHaveBeenCalled();
  });

  it("never lets a cleanup failure block the request", async () => {
    mockBucketCount(1);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.mocked(db.rateLimitBucket.deleteMany).mockRejectedValue(new Error("db unavailable"));

    await expect(checkRateLimit("user_1", "scan_chat", LIMIT, WINDOW_MS)).resolves.toBeUndefined();
  });
});
