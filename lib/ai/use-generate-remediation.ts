"use client";

import { useCallback, useState } from "react";

import type { RemediationPlan, Scan } from "@/lib/parser/schema";
import { saveScan } from "@/lib/scans/store";

// Drives the "Generate AI remediation plan" action: POSTs a scan to the
// remediate route, then merges the returned plan back into the scan and
// persists it. The external store re-renders the dashboard.
export function useGenerateRemediation(scan: Scan) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scan),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to generate remediation plan");
      }
      saveScan({ ...scan, remediationPlan: data.remediationPlan as RemediationPlan });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }, [scan]);

  return { generate, generating, error };
}
