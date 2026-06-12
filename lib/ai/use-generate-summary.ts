"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AISummary, Scan } from "@/lib/parser/schema";
import { saveScanAction } from "@/lib/scans/actions";

// Drives the "Generate AI analysis" action: POSTs a scan to the summarize
// route, then merges the returned AI summary back into the scan, persists it via
// a server action, and refreshes so the server re-renders the dashboard with the
// upgraded summary.
export function useGenerateSummary(scan: Scan) {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scan),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to generate AI summary");
      }
      await saveScanAction({ ...scan, summary: data.summary as AISummary });
      // Refresh inside a transition so `isPending` stays true until the server
      // re-render with the new AI summary actually lands. Combined with
      // `isFetching` below, the UI holds the "generating" state continuously and
      // never flashes the old rule-based state in the gap before the new data
      // arrives.
      startTransition(() => {
        router.refresh();
      });
      toast.success("AI summary generated");
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
