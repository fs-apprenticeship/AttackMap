import "server-only";

import { db } from "@/lib/db";

/** Thrown by `checkRateLimit` once a user exceeds their window's request count. */
export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitExceededError";
  }
}

// How long an expired bucket sticks around before opportunistic cleanup
// removes it. Wider than one window so a request right at the window
// boundary can't race its own cleanup pass.
const CLEANUP_RETENTION_WINDOWS = 2;

// Cleanup runs probabilistically rather than on every call: it's a
// self-upkeep pass (bounding table growth), not correctness-critical, so
// most requests skip the extra round-trip.
const CLEANUP_PROBABILITY = 0.05;

/**
 * Increment a fixed-window request counter for `userId`/`key` and throw
 * `RateLimitExceededError` once it exceeds `limit` within `windowMs`. Counters
 * are stored in Postgres (not in-process), so the limit holds across
 * serverless instances rather than being per-instance like the reconciliation
 * sweep's throttle.
 */
export async function checkRateLimit(
  userId: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const bucket = await db.rateLimitBucket.upsert({
    where: { userId_key_windowStart: { userId, key, windowStart } },
    create: { userId, key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(now - windowMs * CLEANUP_RETENTION_WINDOWS);
    // Best-effort: never let cleanup failure block the actual request.
    await db.rateLimitBucket
      .deleteMany({ where: { userId, key, windowStart: { lt: cutoff } } })
      .catch(() => {});
  }

  if (bucket.count > limit) {
    const retryAfterMs = windowStart.getTime() + windowMs - now;
    throw new RateLimitExceededError(retryAfterMs);
  }
}
