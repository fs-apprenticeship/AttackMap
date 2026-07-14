// Looks up CVEs for a service against the NVD 2.0 API.
//
// nmap emits CPE 2.2 URIs (cpe:/a:openbsd:openssh:9.6p1) while NVD speaks CPE
// 2.3 (cpe:2.3:a:openbsd:openssh:9.6p1:*:...), so we convert before querying.
//
// We try a precise `virtualMatchString` (CPE) match first, but nmap's and NVD's
// CPE dictionaries disagree on vendor names for many products — e.g. nmap says
// `vsftpd:vsftpd` while NVD files the backdoor under `vsftpd_project:vsftpd`, so
// the exact match silently returns nothing. When the CPE match is empty we fall
// back to a vendor-agnostic `keywordSearch` on product + version (derived from
// the CPE when one was supplied). Results are normalized to a small,
// model-friendly shape and cached in-memory to respect NVD's rate limits.

const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const DEFAULT_MAX_RESULTS = 10;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// NVD returns matches oldest-first and offers no severity sort, so requesting a
// page the size of `maxResults` yields the *oldest* CVEs and silently drops the
// recent, high-severity ones — exactly the KEV-relevant ones. We instead fetch a
// wide window, rank it by CVSS ourselves, and slice. NVD caps resultsPerPage at
// 2000; 200 covers all but the largest products in a single request.
const NVD_FETCH_WINDOW = 200;

export type CveSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "none"
  | "unknown";

export interface Cve {
  id: string;
  cvss: number | null;
  severity: CveSeverity;
  summary: string;
  url: string;
}

export interface LookupCvesParams {
  /** A CPE in 2.2 (cpe:/...) or 2.3 (cpe:2.3:...) form. Preferred — most precise. */
  cpe?: string;
  /** Fallback keyword search when no CPE is available. */
  product?: string;
  version?: string;
  /** Cap on returned CVEs (default 10), sorted by CVSS descending. */
  maxResults?: number;
}

/** Thrown when the NVD request fails (rate limit, upstream error, etc.). */
export class CveLookupError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CveLookupError";
  }
}

// ── NVD response shape (only the fields we read) ────────────────────────────

interface NvdCvssMetric {
  cvssData?: { baseScore?: number; baseSeverity?: string };
  baseSeverity?: string; // CVSS v2 puts severity here, not under cvssData
}

interface NvdVulnerability {
  cve?: {
    id?: string;
    descriptions?: { lang: string; value: string }[];
    metrics?: {
      cvssMetricV31?: NvdCvssMetric[];
      cvssMetricV30?: NvdCvssMetric[];
      cvssMetricV2?: NvdCvssMetric[];
    };
  };
}

interface NvdResponse {
  vulnerabilities?: NvdVulnerability[];
}

// ── CPE handling ──────────────────────────────────────────────────────────

/**
 * Convert an nmap CPE 2.2 URI to the CPE 2.3 string NVD's virtualMatchString
 * expects. Already-2.3 strings pass through; unrecognized formats are returned
 * unchanged so NVD can reject them rather than us guessing.
 */
export function toVirtualMatchString(cpe: string): string {
  if (cpe.startsWith("cpe:2.3:")) return cpe;
  if (cpe.startsWith("cpe:/")) return `cpe:2.3:${cpe.slice("cpe:/".length)}`;
  return cpe;
}

/**
 * Pull the product and version out of a CPE (2.2 or 2.3) for the keyword
 * fallback. Wildcards/placeholders (`*`, `-`, empty) are treated as absent.
 */
export function parseCpe(cpe: string): { product?: string; version?: string } {
  const body = cpe.startsWith("cpe:2.3:")
    ? cpe.slice("cpe:2.3:".length)
    : cpe.startsWith("cpe:/")
      ? cpe.slice("cpe:/".length)
      : "";
  if (!body) return {};
  // [part, vendor, product, version, ...]
  const parts = body.split(":");
  const clean = (v: string | undefined) =>
    v && v !== "*" && v !== "-" ? v : undefined;
  return { product: clean(parts[2]), version: clean(parts[3]) };
}

// ── Normalization ─────────────────────────────────────────────────────────

function severityFromScore(score: number | null): CveSeverity {
  if (score === null) return "unknown";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "none";
}

function normalizeCve(entry: NvdVulnerability): Cve | null {
  const cve = entry.cve;
  if (!cve?.id) return null;

  const summary =
    cve.descriptions?.find((d) => d.lang === "en")?.value ??
    cve.descriptions?.[0]?.value ??
    "";

  const m = cve.metrics ?? {};
  const metric =
    m.cvssMetricV31?.[0] ?? m.cvssMetricV30?.[0] ?? m.cvssMetricV2?.[0];
  const cvss = metric?.cvssData?.baseScore ?? null;
  const severityRaw = (
    metric?.cvssData?.baseSeverity ?? metric?.baseSeverity
  )?.toLowerCase();
  const severity: CveSeverity =
    severityRaw === "critical" ||
    severityRaw === "high" ||
    severityRaw === "medium" ||
    severityRaw === "low"
      ? severityRaw
      : severityFromScore(cvss);

  return {
    id: cve.id,
    cvss,
    severity,
    summary,
    url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
  };
}

// ── NVD request ─────────────────────────────────────────────────────────────

const cache = new Map<string, { at: number; data: Cve[] }>();

/**
 * Run a single NVD query and return normalized results sorted by CVSS, capped to
 * `maxResults`. We request a wide window (not just `maxResults`) because NVD
 * returns matches oldest-first with no severity sort — a small page would hand
 * back legacy CVEs and miss the recent high-severity ones. The ranked superset is
 * cached, and each caller slices its own `maxResults` from it.
 */
async function queryNvd(
  param: "virtualMatchString" | "keywordSearch",
  value: string,
  maxResults: number,
): Promise<Cve[]> {
  const search = new URLSearchParams({ [param]: value });
  search.set("resultsPerPage", String(NVD_FETCH_WINDOW));
  const url = `${NVD_API}?${search.toString()}`;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data.slice(0, maxResults);
  }

  // An API key raises NVD's rate limit from 5 to 50 requests per 30s.
  const apiKey = process.env.NVD_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers.apiKey = apiKey;

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (cause) {
    throw new CveLookupError(`NVD request failed: ${String(cause)}`);
  }

  if (!res.ok) {
    const hint =
      res.status === 403 || res.status === 429
        ? " (rate limited — set NVD_API_KEY to raise the limit)"
        : "";
    throw new CveLookupError(`NVD returned ${res.status}${hint}`, res.status);
  }

  const body = (await res.json()) as NvdResponse;
  const ranked = (body.vulnerabilities ?? [])
    .map(normalizeCve)
    .filter((c): c is Cve => c !== null)
    .sort((a, b) => (b.cvss ?? -1) - (a.cvss ?? -1));

  // Cache the full ranked window so different `maxResults` are served from one
  // fetch; slice per call.
  cache.set(url, { at: Date.now(), data: ranked });
  return ranked.slice(0, maxResults);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Look up CVEs affecting a service. Pass a `cpe` when available (most precise),
 * otherwise `product` (+ optional `version`). Returns up to `maxResults` CVEs
 * sorted by CVSS descending. Throws `CveLookupError` on a failed NVD request.
 */
export async function lookupCves(params: LookupCvesParams): Promise<Cve[]> {
  const { cpe, maxResults = DEFAULT_MAX_RESULTS } = params;

  // OS/hardware CPEs (cpe:/o:, cpe:/h:) describe the platform, not a specific
  // service, and match thousands of unrelated CVEs — ignore them so they can't
  // poison the lookup. Only application CPEs are precise enough to query.
  const usableCpe = cpe && !isOsOrHardwareCpe(cpe) ? cpe : undefined;

  if (usableCpe) {
    const byCpe = await queryNvd(
      "virtualMatchString",
      toVirtualMatchString(usableCpe),
      maxResults,
    );
    if (byCpe.length > 0) return byCpe;

    // CPE match came up empty — likely an nmap/NVD vendor-name mismatch. Retry
    // with a keyword search, but only when we have a *version*: a bare product
    // term (e.g. "windows") matches far too broadly to be useful.
    const { product, version } = parseCpe(usableCpe);
    if (product && version) {
      return queryNvd("keywordSearch", `${product} ${version}`, maxResults);
    }
  }

  // Explicit product search. Require a version unless the product is clearly
  // specific (multi-word), again to avoid flooding on a single generic term.
  if (params.product) {
    const specificEnough = Boolean(params.version) || /\s/.test(params.product.trim());
    if (specificEnough) {
      return queryNvd(
        "keywordSearch",
        [params.product, params.version].filter(Boolean).join(" "),
        maxResults,
      );
    }
    return [];
  }

  // Only an OS/hardware (or otherwise unusable) CPE was given, with nothing
  // specific to fall back on — no reliable lookup is possible.
  if (cpe) return [];

  throw new CveLookupError("Provide a cpe or a product to look up CVEs.");
}

/** OS (cpe:/o:) and hardware (cpe:/h:) CPEs — too broad for service CVE lookups. */
function isOsOrHardwareCpe(cpe: string): boolean {
  return /^cpe:\/[oh]:/.test(cpe) || /^cpe:2\.3:[oh]:/.test(cpe);
}

/** Clears the in-memory CVE cache. Exposed for tests. */
export function clearCveCache(): void {
  cache.clear();
}
