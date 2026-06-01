import type { ParsedScan } from "../schema";

const cache = new Map<string, ParsedScan>();

export function saveScanToCache(id: string, scan: ParsedScan): void {
  cache.set(id, scan);
}

export function getScanFromCache(id: string): ParsedScan | undefined {
  return cache.get(id);
}

export function listScansInCache(): ParsedScan[] {
  return Array.from(cache.values());
}

export function clearCache(): void {
  cache.clear();
}
