// Checks CVE IDs against CISA's Known Exploited Vulnerabilities (KEV) catalog.
//
// KEV is not a query API — CISA publishes the entire catalog as one static JSON
// file. So instead of one request per CVE, we download the whole catalog once,
// index it by CVE ID, and answer membership from memory. The catalog is ~1.5MB
// and updates roughly daily, so we cache it hard (24h) — being a few hours stale
// on "is this exploited in the wild" changes nothing, and CISA imposes no rate
// limit or auth. Unlike a per-query cache, a single cached catalog serves every
// lookup for its lifetime.
//
// KEV membership answers the prioritization question CVSS can't: of the CVEs a
// service exposes, which are *actively being exploited right now*.

import { TtlCache } from "@/lib/cache/ttl-cache";

const KEV_CATALOG_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — catalog updates ~daily

/** A KEV catalog entry, normalized to the fields we surface. */
export interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  /** Date CISA added it to the catalog (YYYY-MM-DD). */
  dateAdded: string;
  /** Federal remediation due date (YYYY-MM-DD), when present. */
  dueDate?: string;
  /** True when CISA has linked the CVE to known ransomware campaigns. */
  knownRansomwareUse: boolean;
  shortDescription: string;
}

/** Result of checking a set of CVE IDs against the catalog. */
export interface KevCheckResult {
  /** The queried CVEs that appear in the KEV catalog, with their details. */
  matches: KevEntry[];
  /** Every CVE ID that was checked (normalized, de-duplicated). */
  checked: string[];
  /** The catalog version the answer came from, e.g. "2026.07.10". */
  catalogVersion: string;
}

/** Thrown when the KEV catalog can't be fetched or parsed. */
export class KevLookupError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KevLookupError";
  }
}

// ── CISA catalog response shape (only the fields we read) ───────────────────

interface RawKevVulnerability {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  shortDescription?: string;
}

interface RawKevCatalog {
  catalogVersion?: string;
  vulnerabilities?: RawKevVulnerability[];
}

// ── Normalization ───────────────────────────────────────────────────────────

function normalizeEntry(raw: RawKevVulnerability): KevEntry | null {
  if (!raw.cveID) return null;
  return {
    cveID: raw.cveID.toUpperCase(),
    vendorProject: raw.vendorProject ?? "",
    product: raw.product ?? "",
    vulnerabilityName: raw.vulnerabilityName ?? "",
    dateAdded: raw.dateAdded ?? "",
    // CISA uses the literal strings "Known" / "Unknown"; anything else is
    // treated as not-known so we never over-claim ransomware association.
    dueDate: raw.dueDate || undefined,
    knownRansomwareUse: raw.knownRansomwareCampaignUse === "Known",
    shortDescription: raw.shortDescription ?? "",
  };
}

/** A CVE ID normalized for matching: uppercased and trimmed. */
function normalizeId(id: string): string {
  return id.trim().toUpperCase();
}

// ── Catalog fetch + cache ─────────────────────────────────────────────────────

interface Catalog {
  version: string;
  byId: Map<string, KevEntry>;
}

// A single cached catalog under one fixed key (not a per-query map): the
// whole file serves every lookup until the TTL expires.
const CATALOG_KEY = "catalog";
const cache = new TtlCache<typeof CATALOG_KEY, Catalog>(CACHE_TTL_MS);

async function loadCatalog(): Promise<Catalog> {
  const cached = cache.get(CATALOG_KEY);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch(KEV_CATALOG_URL);
  } catch (cause) {
    throw new KevLookupError(`KEV catalog request failed: ${String(cause)}`);
  }

  if (!res.ok) {
    throw new KevLookupError(
      `KEV catalog returned ${res.status}`,
      res.status,
    );
  }

  let body: RawKevCatalog;
  try {
    body = (await res.json()) as RawKevCatalog;
  } catch (cause) {
    throw new KevLookupError(`KEV catalog was not valid JSON: ${String(cause)}`);
  }

  const byId = new Map<string, KevEntry>();
  for (const raw of body.vulnerabilities ?? []) {
    const entry = normalizeEntry(raw);
    if (entry) byId.set(entry.cveID, entry);
  }

  const data: Catalog = { version: body.catalogVersion ?? "", byId };
  cache.set(CATALOG_KEY, data);
  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check which of `cveIds` appear in CISA's KEV catalog. Downloads and caches the
 * catalog on first use. Input IDs are normalized (uppercased, trimmed) and
 * de-duplicated. Returns only the CVEs that are KEV-listed; the rest are, by
 * definition, not known to be exploited. Throws `KevLookupError` on a failed
 * fetch. Returns an empty result without any network call when given no IDs.
 */
export async function checkKev(cveIds: string[]): Promise<KevCheckResult> {
  const checked = [...new Set(cveIds.map(normalizeId).filter(Boolean))];
  if (checked.length === 0) {
    return { matches: [], checked: [], catalogVersion: "" };
  }

  const catalog = await loadCatalog();
  const matches: KevEntry[] = [];
  for (const id of checked) {
    const entry = catalog.byId.get(id);
    if (entry) matches.push(entry);
  }

  return { matches, checked, catalogVersion: catalog.version };
}

/** Clears the in-memory KEV catalog cache. Exposed for tests. */
export function clearKevCache(): void {
  cache.clear();
}
