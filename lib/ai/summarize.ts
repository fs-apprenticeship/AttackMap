import OpenAI from "openai";
import { z } from "zod";

import { AISummarySchema, type AISummary, type Scan } from "@/lib/nmap/schema";

// Server-only. Generates an AI scan summary via OpenAI structured outputs.
// The rule-based summary produced by the parser is the fallback/default; this
// upgrades a scan's `summary` to `source: "ai"` on explicit request.

const DEFAULT_MODEL = "gpt-4o-mini";

// What we ask the model to produce — narrative only. The risk score/level stay
// rule-based (deterministic, comparable) and topRisks is computed by the route,
// so the model only writes the `executive` prose.
//
// This MUST be a closed object with every field required: OpenAI strict
// structured-output mode rejects optional fields and `default` keywords, which
// is why deriving it from AISummarySchema (topRisks has a default,
// remediationPlan is optional) failed with "Failed to generate AI summary".
const AiSummaryOutputSchema = z.object({
  executive: z.string(),
});

/** Thrown when OPENAI_API_KEY is missing, so the route can return 503. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set");
    this.name = "AiNotConfiguredError";
  }
}

const SYSTEM_PROMPT = [
  "You are a senior security analyst.",
  "You are given the structured results of an Nmap network scan (hosts,",
  "services, and rule-based findings) as JSON.",
  "Write a concise `executive` risk summary for a technical stakeholder:",
  "2-4 sentences characterizing the overall risk, the most significant",
  "exposures, and what they mean for this specific environment.",
  "Base every statement strictly on the provided evidence — do not invent",
  "CVEs, services, vulnerabilities, or hosts that are not present in the data.",
  "A rule-based risk score (0-100) is provided as `ruleBased` for reference;",
  "keep your assessment consistent with it. Be specific and avoid generic filler.",
].join(" ");

/**
 * Distil a parsed scan into a compact, model-friendly payload. Strips ids,
 * timestamps, and raw XML to keep token cost and noise down.
 */
export function distillScan(scan: Scan) {
  return {
    target: scan.target,
    hostCount: scan.hosts.length,
    serviceCount: scan.hosts.reduce((n, h) => n + h.services.length, 0),
    findingCount: scan.findings.length,
    hosts: scan.hosts.map((host) => ({
      ip: host.ipAddress,
      hostname: host.hostname,
      os: host.operatingSystem,
      role: host.role,
      internetExposed: host.internetExposed,
      services: host.services.map((service) => ({
        port: service.port,
        protocol: service.protocol,
        service: service.serviceName,
        product: service.product,
        version: service.version,
        riskLevel: service.riskLevel,
      })),
    })),
    findings: scan.findings.map((finding) => ({
      severity: finding.severity,
      title: finding.title,
      evidence: finding.evidence,
      host: finding.host,
    })),
    // The rule-based estimate, given to the model as a reference point.
    ruleBased: {
      riskScore: scan.summary.riskScore,
      riskLevel: scan.summary.riskLevel,
    },
  };
}

/**
 * Generate an AI summary for a parsed scan. Throws `AiNotConfiguredError` when
 * no API key is set, and rethrows OpenAI/parse failures so the caller can fall
 * back to the existing rule-based summary rather than overwriting good data.
 */
export async function summarizeScan(scan: Scan): Promise<AISummary> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  // OpenAI strict mode rejects the `$schema` key that Zod emits.
  const jsonSchema = z.toJSONSchema(AiSummaryOutputSchema) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Scan results:\n${JSON.stringify(distillScan(scan))}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "scan_summary", strict: true, schema: jsonSchema },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  const parsed = AiSummaryOutputSchema.parse(JSON.parse(raw));

  // The score and level remain rule-based; AI only contributes the narrative.
  return AISummarySchema.parse({
    ...parsed,
    riskScore: scan.summary.riskScore,
    riskLevel: scan.summary.riskLevel,
    source: "ai",
  });
}
