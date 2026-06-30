import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { AiNotConfiguredError } from "@/lib/ai/summarize";
import { CveLookupError, lookupCves } from "@/lib/ai/tools/lookup-cves";
import type { Scan } from "@/lib/parser/schema";

// Server-only. Powers the scan chat: the user asks questions about one parsed
// scan and the model answers from the scan context, calling the NVD-backed
// `lookupCves` tool for live CVE data rather than relying on its own memory
// (which hallucinates CVE IDs).

const DEFAULT_MODEL = "gpt-4o-mini";

// Cap tool-call round-trips so a single turn can't loop indefinitely: enough
// for the model to look up CVEs for a few services and then answer.
const MAX_STEPS = 5;

const SYSTEM_PROMPT = [
  "You are a senior security analyst helping a user understand the results of a",
  "single Nmap network scan. The scan (hosts, services, CPEs, and rule-based",
  "findings) is provided below as JSON — treat it as the only source of truth",
  "about this environment.",
  "",
  "When the user asks about known vulnerabilities or CVEs for a service, call",
  "the `lookupCves` tool. Prefer passing the service's `cpe` (most precise);",
  "fall back to `product` and `version` if no CPE is present. Only cite CVE IDs,",
  "scores, and links that the tool returns — never invent or recall CVEs from",
  "memory. If the tool returns nothing, say so plainly rather than guessing.",
  "",
  "Keep answers concise and specific to this scan. Do not invent hosts,",
  "services, or findings that are not in the data.",
].join("\n");

/**
 * Compact, model-friendly view of a scan for the chat system prompt. Mirrors
 * `distillScan` but keeps each service's `cpe` so the model can hand precise
 * identifiers to the `lookupCves` tool.
 */
function buildScanContext(scan: Scan) {
  return {
    target: scan.target,
    riskScore: scan.summary.riskScore,
    riskLevel: scan.summary.riskLevel,
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
        cpe: service.cpe,
        riskLevel: service.riskLevel,
      })),
    })),
    findings: scan.findings.map((finding) => ({
      severity: finding.severity,
      title: finding.title,
      evidence: finding.evidence,
      host: finding.host,
    })),
  };
}

/** The `lookupCves` tool, exposed to the model for live NVD CVE lookups. */
const cveLookupTool = tool({
  description:
    "Look up known CVEs for a service from the live NVD database. Pass the " +
    "service's CPE when available (most precise), otherwise its product name " +
    "and version. Returns CVEs sorted by CVSS severity.",
  inputSchema: z.object({
    cpe: z
      .string()
      .optional()
      .describe("The service's CPE, e.g. cpe:/a:openbsd:openssh:9.6p1"),
    product: z
      .string()
      .optional()
      .describe("Product name when no CPE is available, e.g. vsftpd"),
    version: z.string().optional().describe("Product version, e.g. 3.0.5"),
    maxResults: z
      .number()
      .optional()
      .describe("Max CVEs to return (default 10), highest severity first"),
  }),
  execute: async ({ cpe, product, version, maxResults }) => {
    try {
      const cves = await lookupCves({ cpe, product, version, maxResults });
      return { cves };
    } catch (error) {
      // Surface the failure to the model so it can explain rather than fabricate.
      if (error instanceof CveLookupError) return { error: error.message };
      throw error;
    }
  },
});

/** The default OpenAI model. Throws `AiNotConfiguredError` if no key is set. */
function defaultModel(): LanguageModel {
  if (!process.env.OPENAI_API_KEY) throw new AiNotConfiguredError();
  return openai(process.env.OPENAI_MODEL || DEFAULT_MODEL);
}

/**
 * Stream a chat response grounded in a single scan. Throws
 * `AiNotConfiguredError` when no API key is set so the route can return 503.
 * `model` is injectable for tests; production uses the configured OpenAI model.
 */
export async function streamScanChat(
  scan: Scan,
  messages: UIMessage[],
  model: LanguageModel = defaultModel(),
) {
  return streamText({
    model,
    system: `${SYSTEM_PROMPT}\n\nScan:\n${JSON.stringify(buildScanContext(scan))}`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(MAX_STEPS),
    tools: { lookupCves: cveLookupTool },
  });
}
