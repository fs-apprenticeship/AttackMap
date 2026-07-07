// Current in-request pipeline cap. Larger scans should move to the large-scan
// path described in docs/LARGE_SCAN_PROCESSING.md rather than raising this
// indefinitely and parsing huge XML payloads inside a route handler.
export const MAX_SCAN_UPLOAD_BYTES = 10 * 1024 * 1024;

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
