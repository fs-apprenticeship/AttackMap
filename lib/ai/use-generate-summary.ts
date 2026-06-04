"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { AISummary, Scan } from "@/lib/parser/schema";
import { saveScan } from "@/lib/scans/store";

// Drives the "Generate AI analysis" action: POSTs a scan to the summarize
// route, then merges the returned AI summary back into the scan and persists
// it. The external store re-renders the dashboard with the upgraded summary.
export function useGenerateSummary(scan: Scan) {
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
      saveScan({ ...scan, summary: data.summary as AISummary });
      toast.success("AI summary generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }, [scan]);

  return { generate, generating, error };
}
