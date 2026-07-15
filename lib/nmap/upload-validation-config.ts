// Tier 1 (small/sync) ceiling. Kept under Vercel's hard 4.5MB Function
// request-body cap so an in-limit file never trips a platform-level 413
// before app validation even runs. Larger scans use the tier below instead
// of raising this indefinitely — see docs/LARGE_SCAN_PROCESSING.md.
export const MAX_SCAN_UPLOAD_BYTES = 4 * 1024 * 1024;

// Tier 2 (large/async) ceiling. Files between MAX_SCAN_UPLOAD_BYTES and this
// go through the chunked-upload + background-job path instead of an
// in-request route/action, since Vercel Functions cannot receive a request
// body this large at all. See docs/LARGE_SCAN_PROCESSING.md.
export const MAX_LARGE_SCAN_UPLOAD_BYTES = 100 * 1024 * 1024;

// Size of each piece the client splits a tier-2 file into before uploading.
// Vercel's hard Function request-body cap is 4.5MB; this leaves headroom for
// HTTP overhead. At 100MB / 3.5MB that's ~29 chunk requests worst case.
export const MAX_UPLOAD_CHUNK_BYTES = 3.5 * 1024 * 1024;

// Guards against a caller lying about chunk count to force excessive rows;
// derived from the two constants above with a small margin.
export const MAX_UPLOAD_CHUNKS = Math.ceil(
  MAX_LARGE_SCAN_UPLOAD_BYTES / MAX_UPLOAD_CHUNK_BYTES,
) + 2;

export const XML_FILE_TYPES = new Set(["text/xml", "application/xml"]);

export const MAX_NMAP_HOSTS = 2048;
export const MAX_NMAP_PORTS = 100_000;
export const MAX_NMAP_SCRIPT_OUTPUT_CHARS = 1_000_000;

export const NMAP_XML_ARRAY_TAGS = [
  "host",
  "port",
  "hostname",
  "cpe",
  "script",
  "elem",
  "table",
  "osmatch",
];

export function formatUploadLimit(bytes = MAX_SCAN_UPLOAD_BYTES): string {
  const mb = bytes / 1024 / 1024;
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}
