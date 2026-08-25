import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { listScansForTarget } from "@/lib/scans/store";
import { buildRiskTrend } from "@/lib/scans/trend";

// Risk-over-time trend for every scan the user owns that shares a `target`
// (see listScansForTarget). Read-only and query-scoped, so GET rather than
// mirroring compare's POST-with-body shape.
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to view scan trends." }, { status: 401 });

  const target = request.nextUrl.searchParams.get("target");
  if (!target)
    return NextResponse.json({ error: "Expected a `target` query parameter." }, { status: 400 });

  const scans = await listScansForTarget(target, userId);
  const points = buildRiskTrend(scans);

  return NextResponse.json({ target, points }, { status: 200 });
}
