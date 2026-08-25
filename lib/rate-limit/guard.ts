import "server-only";

import { NextResponse } from "next/server";

import type { RateLimitConfig } from "@/lib/rate-limit/config";
import { RateLimitExceededError, checkRateLimit } from "@/lib/rate-limit/rate-limiter";

/**
 * Route-level rate-limit guard. Returns a 429 `NextResponse` (with
 * `Retry-After`) once `userId` exceeds `config`'s limit, or `null` when the
 * request is within budget and the route should proceed.
 */
export async function enforceRateLimit(
  userId: string,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  try {
    await checkRateLimit(userId, config.key, config.limit, config.windowMs);
    return null;
  } catch (error) {
    if (!(error instanceof RateLimitExceededError)) throw error;

    const retryAfterSeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }
}
