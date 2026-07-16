import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import epssScores from "@/fixtures/epss/sample-scores.json";
import { EpssLookupError, clearEpssCache, getEpss } from "./get-epss";

const fetchMock = vi.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

// Index the fixture by CVE so the mock can mimic FIRST.org's real contract:
// the API echoes back only the *requested* CVEs that have a record, not the
// whole database.
const fixtureByCve = new Map(
  (epssScores.data as { cve: string }[]).map((e) => [e.cve.toUpperCase(), e]),
);

/** Mimic the EPSS API: return only the requested CVEs that have a record. */
function epssResponseFor(url: string): Response {
  const requested = new URL(url).searchParams.get("cve")?.split(",") ?? [];
  const data = requested
    .map((id) => fixtureByCve.get(id.toUpperCase()))
    .filter((e): e is { cve: string } => Boolean(e));
  return okResponse({ ...epssScores, data, total: data.length });
}

describe("getEpss", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearEpssCache();
    // Default: a faithful EPSS API that filters to the requested CVEs.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(epssResponseFor(url)),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses string scores to numbers and returns them per CVE", async () => {
    const result = await getEpss(["CVE-2021-44228", "CVE-2021-41617"]);

    expect(result.checked).toEqual(["CVE-2021-44228", "CVE-2021-41617"]);
    const log4shell = result.scores.find((s) => s.cve === "CVE-2021-44228");
    expect(log4shell).toEqual({
      cve: "CVE-2021-44228",
      epss: 0.99999,
      percentile: 1,
      date: "2026-07-16",
    });
  });

  it("sorts results by exploitation probability descending", async () => {
    const result = await getEpss([
      "CVE-2020-14145", // lowest epss
      "CVE-2024-6387",
      "CVE-2021-44228", // highest epss
      "CVE-2021-41617",
    ]);

    expect(result.scores.map((s) => s.cve)).toEqual([
      "CVE-2021-44228",
      "CVE-2024-6387",
      "CVE-2021-41617",
      "CVE-2020-14145",
    ]);
  });

  it("queries all requested CVEs in a single comma-separated request", async () => {
    await getEpss(["CVE-2021-44228", "CVE-2024-6387"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    // URLSearchParams encodes the comma in the joined list as %2C.
    expect(url).toContain(`cve=${encodeURIComponent("CVE-2021-44228,CVE-2024-6387")}`);
  });

  it("omits CVEs with no EPSS record instead of inventing a zero", async () => {
    const result = await getEpss(["CVE-2021-44228", "CVE-0000-00000"]);

    expect(result.scores.map((s) => s.cve)).toEqual(["CVE-2021-44228"]);
    // `checked` still reflects everything asked about, scored or not.
    expect(result.checked).toEqual(["CVE-2021-44228", "CVE-0000-00000"]);
  });

  it("normalizes (uppercases, trims) and de-duplicates input IDs", async () => {
    const result = await getEpss([
      " cve-2021-44228 ",
      "CVE-2021-44228",
      "Cve-2024-6387",
    ]);

    expect(result.checked).toEqual(["CVE-2021-44228", "CVE-2024-6387"]);
    expect(result.scores.map((s) => s.cve)).toEqual([
      "CVE-2021-44228",
      "CVE-2024-6387",
    ]);
  });

  it("does not fetch when given no CVE IDs", async () => {
    const result = await getEpss([]);

    expect(result).toEqual({ scores: [], checked: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch when given only blank/whitespace IDs", async () => {
    const result = await getEpss(["", "   "]);

    expect(result.scores).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches scores per CVE: a repeated ID is not re-fetched", async () => {
    await getEpss(["CVE-2021-44228"]);
    await getEpss(["CVE-2021-44228"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches only the uncached IDs on a later, overlapping request", async () => {
    await getEpss(["CVE-2021-44228"]);
    await getEpss(["CVE-2021-44228", "CVE-2024-6387"]);

    // Second call reuses the cached log4shell score and fetches only the new one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain("CVE-2024-6387");
    expect(secondUrl).not.toContain("CVE-2021-44228");
  });

  it("throws EpssLookupError when the API request is not ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    await expect(getEpss(["CVE-2021-44228"])).rejects.toBeInstanceOf(
      EpssLookupError,
    );
  });

  it("throws EpssLookupError when the fetch itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(getEpss(["CVE-2021-44228"])).rejects.toThrow(
      /EPSS request failed/,
    );
  });

  it("does not cache a failed fetch (retries on the next call)", async () => {
    // One-time failure, then fall back to the faithful default implementation.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    await expect(getEpss(["CVE-2021-44228"])).rejects.toBeInstanceOf(
      EpssLookupError,
    );
    const result = await getEpss(["CVE-2021-44228"]);
    expect(result.scores).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
