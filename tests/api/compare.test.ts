import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/scans/compare", () => ({
  compareScans: vi.fn(),
}));

vi.mock("@/lib/scans/store", () => ({
  getScan: vi.fn(),
}));

import { POST } from "@/app/api/scan/compare/route";
import { auth } from "@clerk/nextjs/server";
import { compareScans } from "@/lib/scans/compare";
import { getScan } from "@/lib/scans/store";

const BASE_SCAN = { id: "scan_base" };
const COMPARISON_SCAN = { id: "scan_comparison" };
const COMPARISON = { baseScanId: "scan_base", comparisonScanId: "scan_comparison" };

function postRequest(body: unknown | string): NextRequest {
  return new NextRequest("http://localhost/api/scan/compare", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
});

describe("POST /api/scan/compare", () => {
  const validBody = { baseScanId: "scan_base", comparisonScanId: "scan_comparison" };

  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const res = await POST(postRequest(validBody));

    expect(res.status).toBe(401);
  });

  it("rejects an invalid JSON body", async () => {
    const res = await POST(postRequest("not json"));

    expect(res.status).toBe(400);
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(postRequest({ baseScanId: "scan_base" }));

    expect(res.status).toBe(400);
  });

  it("rejects comparing a scan to itself", async () => {
    const res = await POST(
      postRequest({ baseScanId: "scan_base", comparisonScanId: "scan_base" }),
    );

    expect(res.status).toBe(400);
    expect(getScan).not.toHaveBeenCalled();
  });

  it("returns 404 when either scan is not found (or not owned by this user)", async () => {
    vi.mocked(getScan).mockResolvedValueOnce(BASE_SCAN as never).mockResolvedValueOnce(undefined);

    const res = await POST(postRequest(validBody));

    expect(res.status).toBe(404);
    expect(compareScans).not.toHaveBeenCalled();
  });

  it("scopes both lookups to the authenticated user", async () => {
    vi.mocked(getScan)
      .mockResolvedValueOnce(BASE_SCAN as never)
      .mockResolvedValueOnce(COMPARISON_SCAN as never);
    vi.mocked(compareScans).mockReturnValue(COMPARISON as never);

    await POST(postRequest(validBody));

    expect(getScan).toHaveBeenCalledWith("scan_base", "user_1");
    expect(getScan).toHaveBeenCalledWith("scan_comparison", "user_1");
  });

  it("returns the comparison for two owned scans", async () => {
    vi.mocked(getScan)
      .mockResolvedValueOnce(BASE_SCAN as never)
      .mockResolvedValueOnce(COMPARISON_SCAN as never);
    vi.mocked(compareScans).mockReturnValue(COMPARISON as never);

    const res = await POST(postRequest(validBody));

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.comparison).toEqual(COMPARISON);
    expect(compareScans).toHaveBeenCalledWith(BASE_SCAN, COMPARISON_SCAN);
  });
});
