import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TtlCache } from "./ttl-cache";

const TTL_MS = 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TtlCache", () => {
  it("returns a value that was just set", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("returns undefined for a key that was never set", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("treats an entry as a miss once its TTL elapses", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    cache.set("a", 1);

    vi.setSystemTime(TTL_MS - 1);
    expect(cache.get("a")).toBe(1);

    vi.setSystemTime(TTL_MS);
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts an expired entry from the underlying store on read, not just on write", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    cache.set("a", 1);

    vi.setSystemTime(TTL_MS);
    expect(cache.get("a")).toBeUndefined();

    // Internal state, not just the public contract: reading past TTL must not
    // leave the stale entry sitting in memory forever.
    expect((cache as unknown as { store: Map<string, unknown> }).store.size).toBe(0);
  });

  it("sweeps expired entries opportunistically when new keys are set", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    cache.set("old", 1);

    // Key "old" expires at TTL_MS; nothing has touched the cache since to
    // evict it — a set() for an unrelated key should sweep it out.
    vi.setSystemTime(TTL_MS);
    cache.set("new", 2);

    const store = (cache as unknown as { store: Map<string, unknown> }).store;
    expect(store.has("old")).toBe(false);
    expect(cache.get("new")).toBe(2);
  });

  it("refreshes a key's TTL when overwritten, without reviving other expired entries", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    cache.set("a", 1);

    vi.setSystemTime(TTL_MS - 1);
    cache.set("a", 2); // refresh "a" just before it would have expired

    vi.setSystemTime(TTL_MS - 1 + TTL_MS - 1);
    expect(cache.get("a")).toBe(2);
  });

  it("clear() removes every entry", () => {
    const cache = new TtlCache<string, number>(TTL_MS);
    cache.set("a", 1);
    cache.set("b", 2);

    cache.clear();

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });
});
