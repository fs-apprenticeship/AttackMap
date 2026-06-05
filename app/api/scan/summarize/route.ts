import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { ScanSchema } from "@/lib/parser/schema";
import { AiNotConfiguredError, summarizeScan } from "@/lib/ai/summarize";
import { db } from "@/lib/db";

const TOP_RISKS_LIMIT = 5;
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to use AI analysis." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });

  // Verify ownership before doing any AI work.
  const scanRecord = await db.scan.findFirst({
    where: { id: parsed.data.id, userId },
  });
  if (!scanRecord)
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });

  // Return cached result if one already exists.
  const existing = await db.aiSummary.findUnique({
    where: { scanId: parsed.data.id },
  });
  if (existing) {
    return NextResponse.json({
      summary: {
        executive: existing.executive,
        riskScore: existing.riskScore,
        riskLevel: existing.riskLevel,
        topRisks: existing.topRisks,
        source: existing.source === "rule_based" ? "rule-based" : "ai",
      },
    });
  }

  try {
    const summary = await summarizeScan(parsed.data);

    const topRisks = [...parsed.data.findings]
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity as typeof SEVERITY_ORDER[number]) -
          SEVERITY_ORDER.indexOf(b.severity as typeof SEVERITY_ORDER[number]),
      )
      .slice(0, TOP_RISKS_LIMIT)
      .map((f) => f.title);

    await db.aiSummary.create({
      data: {
        scanId: parsed.data.id,
        executive: summary.executive,
        riskScore: summary.riskScore,
        riskLevel: summary.riskLevel,
        topRisks,
        source: summary.source === "rule-based" ? "rule_based" : "ai",
      },
    });

    revalidateTag(`scans:${userId}`);

    return NextResponse.json({ summary: { ...summary, topRisks } }, { status: 200 });
  } catch (error) {
    if (error instanceof AiNotConfiguredError)
      return NextResponse.json({ error: "AI is not configured on the server." }, { status: 503 });
    console.error("Error generating AI summary:", error);
    return NextResponse.json({ error: "Failed to generate AI summary" }, { status: 500 });
  }
}
