import { auth } from "@clerk/nextjs/server";
import {
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { NextRequest, NextResponse } from "next/server";

import { AiNotConfiguredError } from "@/lib/ai/summarize";
import { streamScanChat } from "@/lib/ai/chat";
import { getScan } from "@/lib/scans/store";
import { setSentryRequestUser } from "@/lib/observability/sentry-request-user";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";

// Chat endpoint for asking questions about a single scan. The client sends the
// conversation plus a `scanId`; we load that scan server-side (ownership-scoped)
// so the scan context is never trusted from the client, then stream the answer.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to use the scan chat." }, { status: 401 });
  setSentryRequestUser(userId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, scanId } = (body ?? {}) as {
    messages?: UIMessage[];
    scanId?: string;
  };
  if (!Array.isArray(messages) || typeof scanId !== "string")
    return NextResponse.json(
      { error: "Expected { messages, scanId }." },
      { status: 400 },
    );

  const scan = await getScan(scanId, userId);
  if (!scan)
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });

  try {
    const result = await streamScanChat(scan, messages);
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError)
      return NextResponse.json({ error: "AI is not configured on the server." }, { status: 503 });
    console.error("Error in scan chat:", error);
    captureSanitizedException(error, "Scan chat failed.", { operation: "scan_chat" });
    return NextResponse.json({ error: "Scan chat failed" }, { status: 500 });
  }
}
