// Shared in-memory TTL cache. Each enrichment lookup (EPSS, KEV, NVD) needs
// the same shape — hold a value for a fixed window, then treat it as a miss —
// just keyed differently (per-CVE, a single catalog, per-query URL).
//
// Expired entries are actively evicted (not just masked on read), so a
// long-lived process doesn't accumulate one entry per distinct key ever
// queried. `set()` deletes-then-reinserts so the Map's iteration order always
// matches insertion recency — including for key refreshes — which lets
// `evictExpired` stop at the first live entry instead of scanning everything.
export class TtlCache<K, V> {
  private readonly store = new Map<K, { at: number; value: V }>();

  constructor(private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at >= this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: K, value: V): void {
    // Delete before re-set so an updated key moves to the end of iteration
    // order, keeping it in recency order for evictExpired's early break.
    this.store.delete(key);
    this.store.set(key, { at: Date.now(), value });
    this.evictExpired();
  }

  clear(): void {
    this.store.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, hit] of this.store) {
      if (now - hit.at < this.ttlMs) break;
      this.store.delete(key);
    }
  }
}
