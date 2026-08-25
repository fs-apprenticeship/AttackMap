// Looks up EPSS scores for CVE IDs from FIRST.org's EPSS API.
//
// EPSS (Exploit Prediction Scoring System) is a data-driven model that estimates
// the probability a CVE will be exploited in the wild in the next 30 days. Where
// CVSS rates *severity* and KEV reports *confirmed* exploitation, EPSS predicts
// *likelihood* — the middle ground that turns a flat CVE list into a ranked one.
//
// Unlike KEV (one static catalog), EPSS is a real query API keyed by CVE, so we
// batch every requested ID into a single comma-separated request. Scores are
// republished daily, so we cache per-CVE with a short TTL and store each score's
// model `date`. A CVE absent from the response has no EPSS record (too new or
// reserved) — we omit it rather than inventing a zero.

import { TtlCache } from "@/lib/cache/ttl-cache";

const EPSS_API = "https://api.first.org/data/v1/epss";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — EPSS republishes daily

/** An EPSS score for a single CVE, parsed to numbers. */
export interface EpssScore {
  cve: string;
  /** Probability (0–1) of exploitation in the wild within the next 30 days. */
  epss: number;
  /** Rank (0–1) of this score among all scored CVEs — 0.97 = more likely than 97%. */
  percentile: number;
  /** The EPSS model date the score came from (YYYY-MM-DD). */
  date: string;
}

/** Result of looking up EPSS scores for a set of CVE IDs. */
export interface EpssResult {
  /** Scores for the queried CVEs that have an EPSS record, sorted by probability descending. */
  scores: EpssScore[];
  /** Every CVE ID that was checked (normalized, de-duplicated). */
  checked: string[];
}

/** Thrown when the EPSS API request fails or returns something unparseable. */
export class EpssLookupError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EpssLookupError";
  }
}

// ── FIRST.org response shape (only the fields we read) ──────────────────────

interface RawEpssEntry {
  cve?: string;
  epss?: string;
  percentile?: string;
  date?: string;
}

interface RawEpssResponse {
  data?: RawEpssEntry[];
}

// ── Normalization ───────────────────────────────────────────────────────────

/** The API returns numeric fields as strings; parse them, dropping anything unparseable. */
function normalizeScore(raw: RawEpssEntry): EpssScore | null {
  if (!raw.cve) return null;
  const epss = Number(raw.epss);
  const percentile = Number(raw.percentile);
  if (!Number.isFinite(epss) || !Number.isFinite(percentile)) return null;
  return {
    cve: raw.cve.toUpperCase(),
    epss,
    percentile,
    date: raw.date ?? "",
  };
}

/** A CVE ID normalized for matching: uppercased and trimmed. */
function normalizeId(id: string): string {
  return id.trim().toUpperCase();
}

// ── Fetch + cache ─────────────────────────────────────────────────────────────

// Per-CVE cache: EPSS is keyed by CVE, so caching individual scores lets
// overlapping batches (different services sharing a CVE) reuse fetched values.
const cache = new TtlCache<string, EpssScore>(CACHE_TTL_MS);

/** Batch-fetch EPSS scores for the given IDs in a single request. */
async function fetchScores(cveIds: string[]): Promise<EpssScore[]> {
  const search = new URLSearchParams({ cve: cveIds.join(",") });
  const url = `${EPSS_API}?${search.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (cause) {
    throw new EpssLookupError(`EPSS request failed: ${String(cause)}`);
  }

  if (!res.ok) {
    throw new EpssLookupError(`EPSS API returned ${res.status}`, res.status);
  }

  let body: RawEpssResponse;
  try {
    body = (await res.json()) as RawEpssResponse;
  } catch (cause) {
    throw new EpssLookupError(`EPSS response was not valid JSON: ${String(cause)}`);
  }

  const scores: EpssScore[] = [];
  for (const raw of body.data ?? []) {
    const score = normalizeScore(raw);
    if (score) scores.push(score);
  }
  return scores;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up EPSS scores for `cveIds`. Input IDs are normalized (uppercased,
 * trimmed) and de-duplicated; fresh cached scores are reused and only the
 * uncached IDs are fetched, in one batched request. Returns only the CVEs that
 * have an EPSS record, sorted by probability descending. Throws `EpssLookupError`
 * on a failed request. Returns an empty result without any network call when
 * given no IDs.
 */
export async function getEpss(cveIds: string[]): Promise<EpssResult> {
  const checked = [...new Set(cveIds.map(normalizeId).filter(Boolean))];
  if (checked.length === 0) return { scores: [], checked: [] };

  const scores: EpssScore[] = [];
  const missing: string[] = [];
  for (const id of checked) {
    const hit = cache.get(id);
    if (hit) scores.push(hit);
    else missing.push(id);
  }

  if (missing.length > 0) {
    for (const score of await fetchScores(missing)) {
      cache.set(score.cve, score);
      scores.push(score);
    }
  }

  scores.sort((a, b) => b.epss - a.epss);
  return { scores, checked };
}

/** Clears the in-memory EPSS score cache. Exposed for tests. */
export function clearEpssCache(): void {
  cache.clear();
}
