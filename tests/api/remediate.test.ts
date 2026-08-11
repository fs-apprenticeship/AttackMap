import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    scan: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/ai/summarize", () => ({
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}));

vi.mock("@/lib/ai/remediate", () => ({
  generateRemediationPlan: vi.fn(),
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

import { POST } from "@/app/api/scan/remediate/route";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { AiNotConfiguredError } from "@/lib/ai/summarize";
import { generateRemediationPlan } from "@/lib/ai/remediate";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";
import { enforceRateLimit } from "@/lib/rate-limit/guard";
import { NextResponse } from "next/server";
import fixture from "@/fixtures/scans/simple-web-server.json";

const SCAN = fixture;
const PLAN = { source: "ai" as const, steps: [] };

function postRequest(body: unknown | string): NextRequest {
  return new NextRequest("http://localhost/api/scan/remediate", {
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

describe("POST /api/scan/remediate", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await POST(postRequest(SCAN));

    expect(res.status).toBe(401);
  });

  it("returns the guard's response once the user is rate-limited", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 }),
    );

    const res = await POST(postRequest(SCAN));

    expect(res.status).toBe(429);
    expect(db.scan.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an invalid JSON body", async () => {
    const res = await POST(postRequest("not json"));

    expect(res.status).toBe(400);
  });

  it("rejects a payload that doesn't match the scan schema", async () => {
    const res = await POST(postRequest({ id: "scan_1" }));

    expect(res.status).toBe(400);
  });

  it("returns 404 when the scan isn't owned by this user", async () => {
    vi.mocked(db.scan.findFirst).mockResolvedValue(null as never);

    const res = await POST(postRequest(SCAN));

    expect(res.status).toBe(404);
    expect(db.scan.findFirst).toHaveBeenCalledWith({
      where: { id: SCAN.id, userId: "user_1" },
    });
    expect(generateRemediationPlan).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is not configured", async () => {
    vi.mocked(db.scan.findFirst).mockResolvedValue({ id: SCAN.id } as never);
    vi.mocked(generateRemediationPlan).mockRejectedValue(new AiNotConfiguredError());

    const res = await POST(postRequest(SCAN));

    expect(res.status).toBe(503);
  });

  it("returns 500 and reports a sanitized exception on unexpected failure", async () => {
    vi.mocked(db.scan.findFirst).mockResolvedValue({ id: SCAN.id } as never);
    vi.mocked(generateRemediationPlan).mockRejectedValue(new Error("openai down"));

    const res = await POST(postRequest(SCAN));

    expect(res.status).toBe(500);
    expect(captureSanitizedException).toHaveBeenCalledWith(
      expect.any(Error),
      "AI remediation plan generation failed.",
      { operation: "ai_remediation" },
    );
  });

  it("returns the generated remediation plan for an owned scan", async () => {
    vi.mocked(db.scan.findFirst).mockResolvedValue({ id: SCAN.id } as never);
    vi.mocked(generateRemediationPlan).mockResolvedValue(PLAN);

    const res = await POST(postRequest(SCAN));

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.remediationPlan).toEqual(PLAN);
  });
});
