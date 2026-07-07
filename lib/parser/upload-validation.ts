import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import {
  MAX_NMAP_HOSTS,
  MAX_NMAP_PORTS,
  MAX_NMAP_SCRIPT_OUTPUT_CHARS,
  MAX_SCAN_UPLOAD_BYTES,
  NMAP_XML_ARRAY_TAGS,
  XML_FILE_TYPES,
  formatUploadLimit,
} from "@/lib/parser/upload-validation-config";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => NMAP_XML_ARRAY_TAGS.includes(name),
  parseAttributeValue: false,
  trimValues: true,
});

export const UploadValidationIssueSchema = z.object({
  code: z.enum([
    "missing_file",
    "invalid_type",
    "file_too_large",
    "empty_file",
    "unsafe_xml",
    "invalid_xml",
    "not_nmap_xml",
    "not_nmap_scan",
    "empty_scan",
    "scan_too_large",
  ]),
  message: z.string(),
});

export type UploadValidationIssue = z.infer<
  typeof UploadValidationIssueSchema
>;

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; issue: UploadValidationIssue };

export type ReadValidatedNmapXmlResult =
  | { ok: true; xml: string; raw: ParsedNmapXml }
  | { ok: false; issue: UploadValidationIssue };

export type ParseValidatedNmapXmlResult =
  | { ok: true; raw: ParsedNmapXml }
  | { ok: false; issue: UploadValidationIssue };

export type ParsedNmapXml = Record<string, unknown>;

export function statusForUploadValidationIssue(
  issue: UploadValidationIssue,
): 400 | 413 {
  return issue.code === "file_too_large" || issue.code === "scan_too_large"
    ? 413
    : 400;
}

export function validateUploadedScanFile(
  file: File | null | undefined,
): UploadValidationResult {
  if (!(file instanceof File)) {
    return issue("missing_file", "No file uploaded.");
  }

  const looksLikeXml =
    file.name.toLowerCase().endsWith(".xml") || XML_FILE_TYPES.has(file.type);
  if (!looksLikeXml) {
    return issue("invalid_type", "Upload a valid Nmap XML file.");
  }

  if (file.size > MAX_SCAN_UPLOAD_BYTES) {
    return issue(
      "file_too_large",
      `Scan file is too large. Upload an XML file under ${formatUploadLimit()}.`,
    );
  }

  if (file.size === 0) {
    return issue("empty_file", "Scan file is empty.");
  }

  return { ok: true };
}

export async function readValidatedNmapXml(
  file: File | null | undefined,
): Promise<ReadValidatedNmapXmlResult> {
  if (!(file instanceof File)) {
    return issue("missing_file", "No file uploaded.");
  }
  const fileValidation = validateUploadedScanFile(file);
  if (!fileValidation.ok) return fileValidation;

  const xml = await file.text();
  const xmlValidation = parseValidatedNmapXmlText(xml);
  if (!xmlValidation.ok) return xmlValidation;

  return { ok: true, xml, raw: xmlValidation.raw };
}

export function validateNmapXmlText(xml: string): UploadValidationResult {
  const parsed = parseValidatedNmapXmlText(xml);
  return parsed.ok ? { ok: true } : parsed;
}

export function parseValidatedNmapXmlText(
  xml: string,
): ParseValidatedNmapXmlResult {
  if (xml.trim().length === 0) {
    return issue("empty_file", "Scan file is empty.");
  }

  const safetyValidation = validateXmlSafety(xml);
  if (!safetyValidation.ok) return safetyValidation;

  if (XMLValidator.validate(xml) !== true) {
    return issue("invalid_xml", "Scan file is not valid XML.");
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return issue("invalid_xml", "Scan file is not valid XML.");
  }

  if (!isRecord(parsed) || !("nmaprun" in parsed)) {
    return issue("not_nmap_xml", "XML file does not look like Nmap output.");
  }

  const nmaprun = parsed.nmaprun;
  if (!isRecord(nmaprun)) {
    return issue("empty_scan", "Nmap XML contains no host results.");
  }

  const identityValidation = validateNmapIdentity(nmaprun);
  if (!identityValidation.ok) return identityValidation;

  const host = nmaprun.host;
  const hosts = asArray(host);
  if (hosts.length === 0) {
    return issue("empty_scan", "Nmap XML contains no host results.");
  }

  const hasUpHost = hosts.some(
    (h) => isRecord(h) && isRecord(h.status) && h.status["@_state"] === "up",
  );
  if (!hasUpHost) {
    return issue(
      "empty_scan",
      "Nmap XML contains no live hosts. Rescan or upload a scan with at least one host that is up.",
    );
  }

  const sizeValidation = validateNmapStructureSize(hosts);
  if (!sizeValidation.ok) return sizeValidation;

  return { ok: true, raw: parsed };
}

export function validateXmlSafety(xml: string): UploadValidationResult {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)) {
    return issue("unsafe_xml", "Scan XML contains unsupported control characters.");
  }

  // Real `nmap -oX` output always emits a bare `<!DOCTYPE nmaprun>` with no
  // internal subset and no external reference, so it carries no XXE risk and
  // should be allowed. What XXE/entity-bomb attacks actually need is either an
  // internal subset (`[...]`) or an external `SYSTEM`/`PUBLIC` reference —
  // reject only those. `<!ENTITY` is rejected unconditionally below as a
  // second layer, since that's the construct an entity-expansion attack
  // ultimately depends on.
  if (hasUnsafeDoctype(xml)) {
    return issue(
      "unsafe_xml",
      "Scan XML cannot include an internal or external DTD subset.",
    );
  }

  if (/<!ENTITY/i.test(xml)) {
    return issue(
      "unsafe_xml",
      "Scan XML cannot include entity declarations.",
    );
  }

  // Real `nmap -oX` output always emits a stylesheet PI pointing at its own
  // local `nmap.xsl` via a `file:` URI; our parser never resolves processing
  // instructions, so that's inert. A PI pointing at a network scheme has no
  // legitimate reason to appear in scan output and is the only variant that
  // could ever cause an SSRF/fetch if some future code processed it.
  if (hasUnsafeStylesheet(xml)) {
    return issue(
      "unsafe_xml",
      "Scan XML stylesheet processing instructions must not reference a network location.",
    );
  }

  return { ok: true };
}

function hasUnsafeDoctype(xml: string): boolean {
  const DOCTYPE_START = /<!DOCTYPE\b/gi;
  let match: RegExpExecArray | null;
  while ((match = DOCTYPE_START.exec(xml))) {
    let i = match.index + match[0].length;
    let bracketDepth = 0;
    while (i < xml.length) {
      const ch = xml[i];
      if (ch === "[") bracketDepth++;
      else if (ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
      else if (ch === ">" && bracketDepth === 0) break;
      i++;
    }
    const declaration = xml.slice(match.index, i + 1);
    if (
      declaration.includes("[") ||
      /\bSYSTEM\b/i.test(declaration) ||
      /\bPUBLIC\b/i.test(declaration)
    ) {
      return true;
    }
  }
  return false;
}

function hasUnsafeStylesheet(xml: string): boolean {
  const matches = xml.match(/<\?xml-stylesheet\b[^?]*\?>/gi);
  if (!matches) return false;

  return matches.some((pi) => {
    const href = pi.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    return /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^file:/i.test(href);
  });
}

function validateNmapIdentity(
  nmaprun: Record<string, unknown>,
): UploadValidationResult {
  const scanner = String(nmaprun["@_scanner"] ?? "").trim().toLowerCase();
  const hasNmapShape =
    scanner === "nmap" ||
    "scaninfo" in nmaprun ||
    "runstats" in nmaprun;

  if (!hasNmapShape) {
    return issue("not_nmap_scan", "XML file is not an Nmap scan result.");
  }

  return { ok: true };
}

function validateNmapStructureSize(hosts: unknown[]): UploadValidationResult {
  if (hosts.length > MAX_NMAP_HOSTS) {
    return issue(
      "scan_too_large",
      `Nmap XML contains too many hosts. Upload scans with ${MAX_NMAP_HOSTS} hosts or fewer.`,
    );
  }

  let portCount = 0;
  let scriptOutputChars = 0;

  for (const host of hosts) {
    if (!isRecord(host)) continue;
    const ports = isRecord(host.ports) ? asArray(host.ports.port) : [];
    portCount += ports.length;

    if (portCount > MAX_NMAP_PORTS) {
      return issue(
        "scan_too_large",
        `Nmap XML contains too many ports. Upload scans with ${MAX_NMAP_PORTS} port entries or fewer.`,
      );
    }

    for (const port of ports) {
      if (!isRecord(port)) continue;
      const scripts = asArray(port.script);
      for (const script of scripts) {
        if (!isRecord(script)) continue;
        scriptOutputChars += String(script["@_output"] ?? "").length;
        if (scriptOutputChars > MAX_NMAP_SCRIPT_OUTPUT_CHARS) {
          return issue(
            "scan_too_large",
            "Nmap XML contains too much script output to process safely.",
          );
        }
      }
    }
  }

  return { ok: true };
}

function issue(
  code: UploadValidationIssue["code"],
  message: string,
): { ok: false; issue: UploadValidationIssue } {
  return {
    ok: false,
    issue: UploadValidationIssueSchema.parse({ code, message }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}
