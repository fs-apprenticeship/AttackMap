export const MAX_SCAN_UPLOAD_BYTES = 4 * 1024 * 1024;

export const MAX_LARGE_SCAN_UPLOAD_BYTES = 100 * 1024 * 1024;

export const MAX_UPLOAD_CHUNK_BYTES = 3.5 * 1024 * 1024;

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
