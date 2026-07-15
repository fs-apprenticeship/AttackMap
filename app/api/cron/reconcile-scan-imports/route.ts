import { NextResponse } from "next/server";

import { runReconciliationSweep } from "@/lib/scans/import-jobs";

export const maxDuration = 300;

export async function GET() {
  const result = await runReconciliationSweep();
  return NextResponse.json(result);
}
