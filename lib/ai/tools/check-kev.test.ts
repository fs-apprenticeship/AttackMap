import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import kevCatalog from "@/fixtures/kev/sample-catalog.json";
import { KevLookupError, checkKev, clearKevCache } from "./check-kev";

const fetchMock = vi.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("checkKev", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearKevCache();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns matches for KEV-listed CVEs and normalizes their fields", async () => {
    fetchMock.mockResolvedValue(okResponse(kevCatalog));

    const result = await checkKev(["CVE-2021-44228", "CVE-2023-4966"]);

    expect(result.catalogVersion).toBe("2026.07.10");
    expect(result.checked).toEqual(["CVE-2021-44228", "CVE-2023-4966"]);
    expect(result.matches.map((m) => m.cveID)).toEqual([
      "CVE-2021-44228",
      "CVE-2023-4966",
    ]);
    expect(result.matches[0]).toMatchObject({
      cveID: "CVE-2021-44228",
      vendorProject: "Apache",
      product: "Log4j2",
      dateAdded: "2021-12-10",
      dueDate: "2021-12-24",
      knownRansomwareUse: true,
    });
    expect(result.matches[0].shortDescription).toContain("Log4j2");
  });

  it("maps knownRansomwareCampaignUse to a boolean both ways", async () => {
    fetchMock.mockResolvedValue(okResponse(kevCatalog));

    const result = await checkKev(["CVE-2021-44228", "CVE-2026-56291"]);

    const known = result.matches.find((m) => m.cveID === "CVE-2021-44228");
    const unknown = result.matches.find((m) => m.cveID === "CVE-2026-56291");
    expect(known?.knownRansomwareUse).toBe(true);
    expect(unknown?.knownRansomwareUse).toBe(false);
  });

  it("omits CVEs that are not in the catalog", async () => {
    fetchMock.mockResolvedValue(okResponse(kevCatalog));

    const result = await checkKev(["CVE-2021-44228", "CVE-0000-00000"]);

    expect(result.matches.map((m) => m.cveID)).toEqual(["CVE-2021-44228"]);
    // `checked` still reflects everything asked about, listed or not.
    expect(result.checked).toEqual(["CVE-2021-44228", "CVE-0000-00000"]);
  });

  it("returns an empty match set when no queried CVEs are exploited", async () => {
    fetchMock.mockResolvedValue(okResponse(kevCatalog));

    const result = await checkKev(["CVE-0000-00001", "CVE-0000-00002"]);

    expect(result.matches).toEqual([]);
    expect(result.catalogVersion).toBe("2026.07.10");
  });

  it("normalizes (uppercases, trims) and de-duplicates input IDs", async () => {
    fetchMock.mockResolvedValue(okResponse(kevCatalog));

    const result = await checkKev([
      " cve-2021-44228 ",
      "CVE-2021-44228",
      "Cve-2023-4966",
    ]);

    expect(result.checked).toEqual(["CVE-2021-44228", "CVE-2023-4966"]);
    expect(result.matches.map((m) => m.cveID)).toEqual([
      "CVE-2021-44228",
      "CVE-2023-4966",
    ]);
  });

  it("does not fetch when given no CVE IDs", async () => {
    const result = await checkKev([]);

    expect(result).toEqual({ matches: [], checked: [], catalogVersion: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch when given only blank/whitespace IDs", async () => {
    const result = await checkKev(["", "   "]);

    expect(result.matches).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches the catalog: one fetch serves repeated checks", async () => {
    fetchMock.mockResolvedValue(okResponse(kevCatalog));

    await checkKev(["CVE-2021-44228"]);
    await checkKev(["CVE-2023-4966"]);
    await checkKev(["CVE-2024-3400"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws KevLookupError when the catalog request is not ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    await expect(checkKev(["CVE-2021-44228"])).rejects.toBeInstanceOf(
      KevLookupError,
    );
  });

  it("throws KevLookupError when the fetch itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(checkKev(["CVE-2021-44228"])).rejects.toThrow(
      /KEV catalog request failed/,
    );
  });

  it("does not cache a failed fetch (retries on the next call)", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce(okResponse(kevCatalog));

    await expect(checkKev(["CVE-2021-44228"])).rejects.toBeInstanceOf(
      KevLookupError,
    );
    const result = await checkKev(["CVE-2021-44228"]);
    expect(result.matches).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
