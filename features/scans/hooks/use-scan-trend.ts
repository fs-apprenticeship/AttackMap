"use client";

import { useEffect, useState } from "react";

import type { RiskTrendPoint } from "@/lib/scans/trend";

type ScanTrendState = {
  points: RiskTrendPoint[];
  loading: boolean;
  error: string | null;
};

// Fetches the risk-over-time trend for every scan sharing `target`, on mount
// and whenever `target` changes. GET (not a server action) since this is a
// read used from a client component and the route is cheap/idempotent.
export function useScanTrend(target: string): ScanTrendState {
  const [state, setState] = useState<ScanTrendState>({
    points: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/scan/trend?target=${encodeURIComponent(target)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to load scan trend");
        return data.points as RiskTrendPoint[];
      })
      .then((points) => {
        if (!cancelled) setState({ points, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Something went wrong";
        setState({ points: [], loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  return state;
}
