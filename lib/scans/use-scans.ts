"use client";

import { useSyncExternalStore } from "react";

import type { Scan } from "@/lib/types";
import {
  getScansSnapshot,
  getServerScansSnapshot,
  subscribeScans,
} from "./store";

// `false` during SSR and the first client render, `true` after hydration.
// Lets pages distinguish "still loading the browser cache" from "empty".
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useScans(): { scans: Scan[]; loading: boolean } {
  const scans = useSyncExternalStore(
    subscribeScans,
    getScansSnapshot,
    getServerScansSnapshot,
  );
  return { scans, loading: !useHydrated() };
}

export function useScan(id: string): { scan: Scan | undefined; loading: boolean } {
  const { scans, loading } = useScans();
  return { scan: scans.find((scan) => scan.id === id), loading };
}
