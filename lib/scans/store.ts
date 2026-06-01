import type { Scan } from "@/lib/types";

// Browser-local persistence for parsed scans. Scans are analyzed on the server
// and cached here in the browser — nothing is stored remotely. Exposed as an
// external store so components can read it with `useSyncExternalStore`.

const STORAGE_KEY = "attackmap:scans:v1";

const EMPTY: Scan[] = [];
const listeners = new Set<() => void>();

// Snapshot cache: `getSnapshot` must return a stable reference between renders,
// so we only recompute when the raw localStorage string actually changes.
let cachedRaw: string | null = null;
let cachedScans: Scan[] = EMPTY;

function readRaw(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function emit(): void {
  for (const listener of listeners) listener();
}

function write(scans: Scan[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
  emit();
}

/** Subscribe to scan changes (cross-tab via `storage`, same-tab via writes). */
export function subscribeScans(callback: () => void): () => void {
  listeners.add(callback);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", callback);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", callback);
    }
  };
}

/** Cached snapshot of all scans, most recently uploaded first. */
export function getScansSnapshot(): Scan[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedScans;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedScans = Array.isArray(parsed)
      ? (parsed as Scan[]).sort((a, b) =>
          b.uploadedAt.localeCompare(a.uploadedAt),
        )
      : EMPTY;
  } catch {
    cachedScans = EMPTY;
  }
  return cachedScans;
}

export function getServerScansSnapshot(): Scan[] {
  return EMPTY;
}

export function listScans(): Scan[] {
  return getScansSnapshot();
}

export function getScan(id: string): Scan | undefined {
  return getScansSnapshot().find((scan) => scan.id === id);
}

/** Saves a scan, replacing any existing entry with the same id. */
export function saveScan(scan: Scan): void {
  const next = getScansSnapshot().filter((existing) => existing.id !== scan.id);
  next.push(scan);
  write(next);
}

export function deleteScan(id: string): void {
  write(getScansSnapshot().filter((scan) => scan.id !== id));
}
