"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import type { RemediationPlan, Scan } from "@/lib/parser/schema";
import { saveScanAction } from "@/lib/scans/actions";

// Drives the "Generate AI remediation plan" action: POSTs a scan to the
// remediate route, then merges the returned plan back into the scan, persists it
// via a server action, and refreshes so the server re-renders the dashboard.
export function useGenerateRemediation(scan: Scan) {
  const router = useRouter();
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
      await saveScanAction({
        ...scan,
        remediationPlan: data.remediationPlan as RemediationPlan,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }, [scan, router]);

  return { generate, generating, error };
}
