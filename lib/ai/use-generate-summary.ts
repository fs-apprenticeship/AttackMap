"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import type { AISummary, Scan } from "@/lib/parser/schema";
import { saveScanAction } from "@/lib/scans/actions";

// Drives the "Generate AI analysis" action: POSTs a scan to the summarize
// route, then merges the returned AI summary back into the scan, persists it via
// a server action, and refreshes so the server re-renders the dashboard with the
// upgraded summary.
export function useGenerateSummary(scan: Scan) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }, [scan, router]);

  return { generate, generating, error };
}
