import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { compareScans } from "@/lib/scans/compare";
import { getScan } from "@/lib/scans/store";

const CompareRequestSchema = z.object({
  baseScanId: z.string(),
  comparisonScanId: z.string(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to compare scans." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CompareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid comparison payload" },
      { status: 400 },
    );
  }

  const { baseScanId, comparisonScanId } = parsed.data;
  if (baseScanId === comparisonScanId) {
    return NextResponse.json(
      { error: "Choose two different scans to compare." },
      { status: 400 },
    );
  }

  const [baseScan, comparisonScan] = await Promise.all([
    getScan(baseScanId, userId),
    getScan(comparisonScanId, userId),
  ]);

  if (!baseScan || !comparisonScan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  return NextResponse.json(
    { comparison: compareScans(baseScan, comparisonScan) },
    { status: 200 },
  );
}
