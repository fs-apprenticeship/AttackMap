import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/scans/store", () => ({
  getScan: vi.fn(),
}));

vi.mock("@/lib/ai/summarize", () => ({
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}));

vi.mock("@/lib/ai/chat", () => ({
  streamScanChat: vi.fn(),
}));

vi.mock("@/lib/observability/sentry-request-user", () => ({
  setSentryRequestUser: vi.fn(),
}));

vi.mock("@/lib/observability/capture-sanitized-exception", () => ({
  captureSanitizedException: vi.fn(),
}));

vi.mock("@/lib/rate-limit/guard", () => ({
  enforceRateLimit: vi.fn(),
}));

// Route-level behavior (auth/validation/error branching) is what's under test
// here — the streaming plumbing itself is exercised for real in
// lib/ai/chat.test.ts, so stub it out to a value these two helpers accept.
vi.mock("ai", () => ({
  createUIMessageStreamResponse: vi.fn(
    ({ stream }: { stream: unknown }) => new Response(JSON.stringify({ stream })),
  ),
  toUIMessageStream: vi.fn(({ stream }: { stream: unknown }) => stream),
}));

import { POST } from "@/app/api/scan/chat/route";
import { auth } from "@clerk/nextjs/server";
import { getScan } from "@/lib/scans/store";
import { AiNotConfiguredError } from "@/lib/ai/summarize";
import { streamScanChat } from "@/lib/ai/chat";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";
import { enforceRateLimit } from "@/lib/rate-limit/guard";
import { NextResponse } from "next/server";

const SCAN = { id: "scan_1" };
const MESSAGES = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];

function postRequest(body: unknown | string): NextRequest {
  return new NextRequest("http://localhost/api/scan/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
  vi.mocked(enforceRateLimit).mockResolvedValue(null);
});

describe("POST /api/scan/chat", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await POST(postRequest({ messages: MESSAGES, scanId: SCAN.id }));

    expect(res.status).toBe(401);
  });

  it("returns the guard's response once the user is rate-limited", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 }),
    );

    const res = await POST(postRequest({ messages: MESSAGES, scanId: SCAN.id }));

    expect(res.status).toBe(429);
    expect(getScan).not.toHaveBeenCalled();
  });

  it("rejects an invalid JSON body", async () => {
    const res = await POST(postRequest("not json"));

    expect(res.status).toBe(400);
  });

  it("rejects a body missing messages or scanId", async () => {
    const res = await POST(postRequest({ messages: MESSAGES }));

    expect(res.status).toBe(400);
    expect(getScan).not.toHaveBeenCalled();
  });

  it("returns 404 when the scan isn't owned by this user", async () => {
    vi.mocked(getScan).mockResolvedValue(undefined);

    const res = await POST(postRequest({ messages: MESSAGES, scanId: SCAN.id }));

    expect(res.status).toBe(404);
    expect(getScan).toHaveBeenCalledWith(SCAN.id, "user_1");
    expect(streamScanChat).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is not configured", async () => {
    vi.mocked(getScan).mockResolvedValue(SCAN as never);
    vi.mocked(streamScanChat).mockRejectedValue(new AiNotConfiguredError());

    const res = await POST(postRequest({ messages: MESSAGES, scanId: SCAN.id }));

    expect(res.status).toBe(503);
  });

  it("returns 500 and reports a sanitized exception on unexpected failure", async () => {
    vi.mocked(getScan).mockResolvedValue(SCAN as never);
    vi.mocked(streamScanChat).mockRejectedValue(new Error("openai down"));

    const res = await POST(postRequest({ messages: MESSAGES, scanId: SCAN.id }));

    expect(res.status).toBe(500);
    expect(captureSanitizedException).toHaveBeenCalledWith(
      expect.any(Error),
      "Scan chat failed.",
      { operation: "scan_chat" },
    );
  });

  it("streams a response grounded in the owned scan", async () => {
    vi.mocked(getScan).mockResolvedValue(SCAN as never);
    vi.mocked(streamScanChat).mockResolvedValue({ stream: "fake-stream" } as never);

    const res = await POST(postRequest({ messages: MESSAGES, scanId: SCAN.id }));

    expect(res.status).toBe(200);
    expect(streamScanChat).toHaveBeenCalledWith(SCAN, MESSAGES);
  });
});
