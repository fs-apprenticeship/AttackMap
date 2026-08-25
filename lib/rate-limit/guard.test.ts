import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit/rate-limiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rate-limiter")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { enforceRateLimit } from "./guard";
import { RateLimitExceededError, checkRateLimit } from "./rate-limiter";
import type { RateLimitConfig } from "./config";

const CONFIG: RateLimitConfig = { key: "scan_chat", limit: 60, windowMs: 60 * 60 * 1000 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enforceRateLimit", () => {
  it("returns null when the user is within budget", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(undefined);

    const result = await enforceRateLimit("user_1", CONFIG);

    expect(result).toBeNull();
    expect(checkRateLimit).toHaveBeenCalledWith("user_1", CONFIG.key, CONFIG.limit, CONFIG.windowMs);
  });

  it("returns a 429 with a Retry-After header once the limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new RateLimitExceededError(90_000));

    const result = await enforceRateLimit("user_1", CONFIG);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    expect(result!.headers.get("Retry-After")).toBe("90");
  });

  it("rounds a sub-second retry up to at least 1 second", async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new RateLimitExceededError(1));

    const result = await enforceRateLimit("user_1", CONFIG);

    expect(result!.headers.get("Retry-After")).toBe("1");
  });

  it("rethrows any error that isn't RateLimitExceededError", async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error("db unavailable"));

    await expect(enforceRateLimit("user_1", CONFIG)).rejects.toThrow("db unavailable");
  });
});
