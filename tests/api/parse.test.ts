import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/sync", () => ({
  getOptionalAuth: vi.fn(),
}));

vi.mock("@/lib/scans/store", () => ({
  saveScanChunked: vi.fn(),
}));

vi.mock("@/lib/scans/cache", () => ({
  invalidateScansCache: vi.fn(),
}));

vi.mock("@/lib/observability/capture-sanitized-exception", () => ({
  captureSanitizedException: vi.fn(),
}));

import { POST } from "@/app/api/scan/parse/route";
import { getOptionalAuth } from "@/lib/auth/sync";
import { saveScanChunked } from "@/lib/scans/store";
import { invalidateScansCache } from "@/lib/scans/cache";
import { captureSanitizedException } from "@/lib/observability/capture-sanitized-exception";

const UP_HOST = `<host starttime="1" endtime="2"><status state="up" reason="user-set" reason_ttl="0"/><address addr="10.0.0.1" addrtype="ipv4"/><ports><port protocol="tcp" portid="22"><state state="open" reason="syn-ack" reason_ttl="0"/><service name="ssh"/></port></ports></host>`;

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<nmaprun scanner="nmap" args="nmap -oX out 10.0.0.0/24" start="1" startstr="today" version="7.94SVN" xmloutputversion="1.05">
<scaninfo type="connect" protocol="tcp" numservices="1" services="22"/>
${UP_HOST}
<runstats><finished time="2" timestr="today" summary="done" elapsed="1" exit="success"/><hosts up="1" down="0" total="1"/></runstats>
</nmaprun>`;

function makeRequest(file: File | null): NextRequest {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return new NextRequest("http://localhost/api/scan/parse", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOptionalAuth).mockResolvedValue("user_1");
});

describe("POST /api/scan/parse", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(getOptionalAuth).mockResolvedValue(null);

    const res = await POST(makeRequest(new File([VALID_XML], "scan.xml", { type: "text/xml" })));

    expect(res.status).toBe(401);
  });

  it("rejects a request with no file field", async () => {
    const res = await POST(makeRequest(null));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No file uploaded");
  });

  it("rejects a file that doesn't look like XML", async () => {
    const file = new File(["hello"], "scan.txt", { type: "text/plain" });

    const res = await POST(makeRequest(file));

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("invalid_type");
  });

  it("rejects an empty scan file", async () => {
    const file = new File([""], "scan.xml", { type: "text/xml" });

    const res = await POST(makeRequest(file));

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("empty_file");
  });

  it("parses and saves a valid scan, invalidating the cache", async () => {
    const file = new File([VALID_XML], "scan.xml", { type: "text/xml" });

    const res = await POST(makeRequest(file));

    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.filename).toBe("scan.xml");
    expect(body.hosts).toHaveLength(1);
    expect(saveScanChunked).toHaveBeenCalledWith(expect.objectContaining({ filename: "scan.xml" }), "user_1");
    expect(invalidateScansCache).toHaveBeenCalledWith("user_1");
  });

  it("returns 500 and reports a sanitized exception when saving fails", async () => {
    vi.mocked(saveScanChunked).mockRejectedValue(new Error("db unavailable"));
    const file = new File([VALID_XML], "scan.xml", { type: "text/xml" });

    const res = await POST(makeRequest(file));

    expect(res.status).toBe(500);
    expect(captureSanitizedException).toHaveBeenCalledWith(
      expect.any(Error),
      "Nmap scan parsing failed.",
      { operation: "scan_parse" },
    );
  });
});
