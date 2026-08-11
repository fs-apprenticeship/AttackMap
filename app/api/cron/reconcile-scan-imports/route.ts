import { NextRequest, NextResponse } from "next/server";

import { runReconciliationSweep } from "@/lib/scans/import-jobs";
import { runRetentionSweep } from "@/lib/scans/retention";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reconciliation runs every tick (throttled internally to ~once per 2min);
  // retention is far cheaper to skip most ticks, so it self-throttles to
  // ~once/day rather than running on this endpoint's full 10-minute cadence.
  const [reconciliation, retention] = await Promise.all([
    runReconciliationSweep(),
    runRetentionSweep(),
  ]);
  return NextResponse.json({ reconciliation, retention });
}
