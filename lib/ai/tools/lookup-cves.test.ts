import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import nvdResponse from "@/fixtures/nvd/openssh-cves.json";
import {
  CveLookupError,
  clearCveCache,
  lookupCves,
  parseCpe,
  toVirtualMatchString,
} from "./lookup-cves";

const fetchMock = vi.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("toVirtualMatchString", () => {
  it("converts an nmap CPE 2.2 URI to a CPE 2.3 string", () => {
    expect(toVirtualMatchString("cpe:/a:openbsd:openssh:9.6p1")).toBe(
      "cpe:2.3:a:openbsd:openssh:9.6p1",
    );
  });

  it("passes through a CPE already in 2.3 form", () => {
    const cpe = "cpe:2.3:a:openbsd:openssh:9.6p1:*:*:*:*:*:*:*";
    expect(toVirtualMatchString(cpe)).toBe(cpe);
  });

  it("leaves an unrecognized string unchanged", () => {
    expect(toVirtualMatchString("openssh")).toBe("openssh");
  });
});

describe("parseCpe", () => {
  it("extracts product and version from a CPE 2.2 URI", () => {
    expect(parseCpe("cpe:/a:vsftpd:vsftpd:2.3.4")).toEqual({
      product: "vsftpd",
      version: "2.3.4",
    });
  });

  it("extracts product and version from a CPE 2.3 string", () => {
    expect(parseCpe("cpe:2.3:a:openbsd:openssh:9.6p1:*:*:*:*:*:*:*")).toEqual({
      product: "openssh",
      version: "9.6p1",
    });
  });

  it("treats wildcard/missing version as absent", () => {
    expect(parseCpe("cpe:/a:protocol_labs:go-ipfs")).toEqual({
      product: "go-ipfs",
      version: undefined,
    });
  });
});

describe("lookupCves", () => {
  const originalKey = process.env.NVD_API_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    clearCveCache();
    delete process.env.NVD_API_KEY;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.NVD_API_KEY;
    else process.env.NVD_API_KEY = originalKey;
  });

  it("queries NVD by virtualMatchString (converted CPE) and normalizes results", async () => {
    fetchMock.mockResolvedValue(okResponse(nvdResponse));

    const cves = await lookupCves({ cpe: "cpe:/a:openbsd:openssh:9.6p1" });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(
      `virtualMatchString=${encodeURIComponent("cpe:2.3:a:openbsd:openssh:9.6p1")}`,
    );

    // Sorted by CVSS descending: 8.1 before 6.8.
    expect(cves.map((c) => c.id)).toEqual(["CVE-2024-6387", "CVE-2025-26465"]);
    expect(cves[0]).toMatchObject({
      id: "CVE-2024-6387",
      cvss: 8.1,
      severity: "high",
      url: "https://nvd.nist.gov/vuln/detail/CVE-2024-6387",
    });
    expect(cves[0].summary).toContain("OpenSSH");
    expect(cves[1].severity).toBe("medium");
  });

  it("falls back to keywordSearch (from the CPE) when the CPE match is empty", async () => {
    // First call (virtualMatchString) returns nothing — the nmap/NVD vendor
    // mismatch case; second call (keywordSearch) returns results.
    fetchMock
      .mockResolvedValueOnce(okResponse({ vulnerabilities: [] }))
      .mockResolvedValueOnce(okResponse(nvdResponse));

    const cves = await lookupCves({ cpe: "cpe:/a:vsftpd:vsftpd:2.3.4" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(firstUrl).toContain("virtualMatchString");
    expect(secondUrl).toContain("keywordSearch=vsftpd+2.3.4");
    expect(cves.length).toBeGreaterThan(0);
  });

  it("falls back to keywordSearch when no CPE is given", async () => {
    fetchMock.mockResolvedValue(okResponse({ vulnerabilities: [] }));

    await lookupCves({ product: "vsftpd", version: "3.0.5" });

    const url = fetchMock.mock.calls[0][0] as string;
    // URLSearchParams encodes spaces as "+".
    expect(url).toContain("keywordSearch=vsftpd+3.0.5");
    expect(url).not.toContain("virtualMatchString");
  });

  it("respects maxResults", async () => {
    fetchMock.mockResolvedValue(okResponse(nvdResponse));

    const cves = await lookupCves({
      cpe: "cpe:/a:openbsd:openssh:9.6p1",
      maxResults: 1,
    });

    expect(cves).toHaveLength(1);
    expect(cves[0].id).toBe("CVE-2024-6387");
  });

  it("throws when neither cpe nor product is provided", async () => {
    await expect(lookupCves({})).rejects.toBeInstanceOf(CveLookupError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws CveLookupError with a rate-limit hint on 403", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    } as Response);

    await expect(
      lookupCves({ cpe: "cpe:/a:openbsd:openssh:9.6p1" }),
    ).rejects.toThrow(/403.*rate limited/i);
  });

  it("caches identical queries (one fetch for repeated calls)", async () => {
    fetchMock.mockResolvedValue(okResponse(nvdResponse));

    await lookupCves({ cpe: "cpe:/a:openbsd:openssh:9.6p1" });
    await lookupCves({ cpe: "cpe:/a:openbsd:openssh:9.6p1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the apiKey header when NVD_API_KEY is set", async () => {
    process.env.NVD_API_KEY = "test-key";
    fetchMock.mockResolvedValue(okResponse(nvdResponse));

    await lookupCves({ cpe: "cpe:/a:openbsd:openssh:9.6p1" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).apiKey).toBe("test-key");
  });
});
