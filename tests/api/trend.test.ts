import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/scans/store", () => ({
  listScansForTarget: vi.fn(),
}));

vi.mock("@/lib/scans/trend", () => ({
  buildRiskTrend: vi.fn(),
}));

import { GET } from "@/app/api/scan/trend/route";
import { auth } from "@clerk/nextjs/server";
import { listScansForTarget } from "@/lib/scans/store";
import { buildRiskTrend } from "@/lib/scans/trend";

const SCANS = [{ id: "scan_1" }, { id: "scan_2" }];
const POINTS = [
  { scanId: "scan_1", at: "2026-01-01T00:00:00.000Z", riskScore: 10, riskLevel: "low" },
  { scanId: "scan_2", at: "2026-02-01T00:00:00.000Z", riskScore: 40, riskLevel: "high" },
];

function getRequest(target?: string): NextRequest {
  const url = new URL("http://localhost/api/scan/trend");
  if (target !== undefined) url.searchParams.set("target", target);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
  vi.mocked(listScansForTarget).mockResolvedValue(SCANS as never);
  vi.mocked(buildRiskTrend).mockReturnValue(POINTS as never);
});

describe("GET /api/scan/trend", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await GET(getRequest("10.0.0.1"));

    expect(res.status).toBe(401);
  });

  it("rejects a request with no target query param", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(400);
    expect(listScansForTarget).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the authenticated user and target", async () => {
    await GET(getRequest("10.0.0.1"));

    expect(listScansForTarget).toHaveBeenCalledWith("10.0.0.1", "user_1");
  });

  it("returns the target and computed trend points", async () => {
    const res = await GET(getRequest("10.0.0.1"));

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ target: "10.0.0.1", points: POINTS });
    expect(buildRiskTrend).toHaveBeenCalledWith(SCANS);
  });

  it("returns an empty points array for a target with no scans", async () => {
    vi.mocked(listScansForTarget).mockResolvedValue([]);
    vi.mocked(buildRiskTrend).mockReturnValue([]);

    const res = await GET(getRequest("10.0.0.1"));

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.points).toEqual([]);
  });
});
