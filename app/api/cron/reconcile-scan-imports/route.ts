import { NextRequest, NextResponse } from "next/server";

import { runReconciliationSweep } from "@/lib/scans/import-jobs";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReconciliationSweep();
  return NextResponse.json(result);
}
