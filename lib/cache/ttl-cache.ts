// Shared in-memory TTL cache. Each enrichment lookup (EPSS, KEV, NVD) needs
// the same shape — hold a value for a fixed window, then treat it as a miss —
// just keyed differently (per-CVE, a single catalog, per-query URL).
export class TtlCache<K, V> {
  private readonly store = new Map<K, { at: number; value: V }>();

  constructor(private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const hit = this.store.get(key);
    if (!hit || Date.now() - hit.at >= this.ttlMs) return undefined;
    return hit.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { at: Date.now(), value });
  }

  clear(): void {
    this.store.clear();
  }
}
