import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScanSchema } from "@/lib/parser/schema";
import { AiNotConfiguredError } from "@/lib/ai/summarize";
import { generateRemediationPlan } from "@/lib/ai/remediate";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to use AI remediation." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid scan payload" }, { status: 400 });

  try {
    const remediationPlan = await generateRemediationPlan(parsed.data);
    return NextResponse.json({ remediationPlan }, { status: 200 });
  } catch (error) {
    if (error instanceof AiNotConfiguredError)
      return NextResponse.json({ error: "AI is not configured on the server." }, { status: 503 });
    console.error("Error generating remediation plan:", error);
    return NextResponse.json({ error: "Failed to generate remediation plan" }, { status: 500 });
  }
}
