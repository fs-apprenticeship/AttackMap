import { NextResponse } from "next/server";

import { runReconciliationSweep } from "@/lib/scans/import-jobs";

export const maxDuration = 300;

// Daily safety net for large-scan imports whose after()-scheduled processing
// never finished (crashed, killed by maxDuration, or never ran). Vercel
// invokes this on the schedule in vercel.json (capped at once/day on the
// Hobby plan). Faster complements to this: the GitHub Actions schedule
// (.github/workflows/reconcile-scan-imports.yml, calls this same endpoint)
// and the piggyback trigger fired from page loads
// (lib/scans/reconcile-trigger.ts).
//
// Deliberately unauthenticated: this deploy has no Vercel dashboard access
// to add a CRON_SECRET env var. That's safe here — the endpoint takes no
// input and only retries/fails jobs already stuck in the DB under their own
// stored userId, so an arbitrary caller can't target anything. The only real
// risk (compute-cost abuse) is bounded by runReconciliationSweep()'s own
// shared cooldown, not by who's allowed to call this. See
// docs/LARGE_SCAN_PROCESSING.md.
export async function GET() {
  const result = await runReconciliationSweep();
  return NextResponse.json(result);
}
