import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanSchema } from "@/lib/nmap/schema";
import { AiNotConfiguredError, summarizeScan } from "@/lib/ai/summarize";
import { invalidateScansCache } from "@/lib/scans/cache";
import { db } from "@/lib/db";
import { setSentryRequestUser } from "@/lib/observability/sentry-request-user";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";
import { SUMMARIZE_RATE_LIMIT } from "@/lib/rate-limit/config";
import { enforceRateLimit } from "@/lib/rate-limit/guard";

const TOP_RISKS_LIMIT = 5;
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to use AI analysis." }, { status: 401 });
  setSentryRequestUser(userId);

  const limited = await enforceRateLimit(userId, SUMMARIZE_RATE_LIMIT);
  if (limited) return limited;

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

  // Always regenerate on request: the user explicitly asked for a fresh AI
  // summary, so we call the model and overwrite any existing one (upsert below).

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

    // Upsert (not create): a rule-based baseline row already exists from
    // upload, so we overwrite the summary fields. `remediation` is left
    // untouched here — it's owned by the remediate flow.
    const summaryFields = {
      executive: summary.executive,
      riskScore: summary.riskScore,
      riskLevel: summary.riskLevel,
      topRisks,
      source: (summary.source === "rule-based" ? "rule_based" : "ai") as
        | "ai"
        | "rule_based",
    };
    await db.aiSummary.upsert({
      where: { scanId: parsed.data.id },
      update: summaryFields,
      create: { scanId: parsed.data.id, ...summaryFields },
    });

    invalidateScansCache(userId);

    return NextResponse.json({ summary: { ...summary, topRisks } }, { status: 200 });
  } catch (error) {
    if (error instanceof AiNotConfiguredError)
      return NextResponse.json({ error: "AI is not configured on the server." }, { status: 503 });
    console.error("Error generating AI summary:", error);
    captureSanitizedException(error, "AI summary generation failed.", {
      operation: "ai_summary",
    });
    return NextResponse.json({ error: "Failed to generate AI summary" }, { status: 500 });
  }
}
