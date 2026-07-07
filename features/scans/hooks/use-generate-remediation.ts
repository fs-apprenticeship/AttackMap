"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { RemediationPlan, Scan } from "@/lib/nmap/schema";
import { saveScanAction } from "@/lib/scans/actions";

// Drives the "Generate AI remediation plan" action: POSTs a scan to the
// remediate route, then merges the returned plan back into the scan, persists it
// via a server action, and refreshes so the server re-renders the dashboard.
export function useGenerateRemediation(scan: Scan) {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setIsFetching(true);
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
      // Refresh inside a transition so `isPending` holds the "generating" state
      // until the server re-render with the new plan lands — no flash of the
      // previous (rule-based) state in the gap before the new data arrives.
      startTransition(() => {
        router.refresh();
      });
      toast.success("AI remediation plan generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setIsFetching(false);
    }
  }, [scan, router]);

  return { generate, generating: isFetching || isPending, error };
}
