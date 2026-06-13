import OpenAI from "openai";
import { z } from "zod";

import {
  RemediationStepSchema,
  type RemediationPlan,
  type Scan,
} from "@/lib/parser/schema";
import { AiNotConfiguredError, distillScan } from "@/lib/ai/summarize";

// Server-only. Generates a context-aware remediation plan via OpenAI structured
// outputs. Unlike the rule-based plan (static per-finding advice), this reads
// the whole scan to produce prioritized, environment-specific steps with
// concrete commands, cross-finding reasoning, and verification.

const DEFAULT_MODEL = "gpt-4o-mini";

const RemediationOutputSchema = z.object({
  steps: z.array(RemediationStepSchema),
});

const SYSTEM_PROMPT = [
  "You are a senior security engineer producing a remediation plan from the",
  "structured results of an Nmap scan (hosts, services, and findings) given as",
  "JSON. Produce a prioritized list of `steps`, ordered by real-world risk",
  "(now first). For each step provide these fields:",
  "`priority` (now | next | later);",
  "`title` (a short imperative action);",
  "`summary` (1-2 plain sentences on what to do and why, specific to this",
  "environment — reference the actual detected products and versions);",
  "`steps` (an array of ordered, concrete actions; use inline `code` for paths",
  "or values, and wrap any standalone command or snippet in a fenced ``` code",
  "block; empty array if not needed);",
  "`commands` (an array of exact commands or config snippets to run, each a",
  "separate string with NO markdown fences; empty array if none);",
  "`verification` (a single command or check to confirm the fix; whenever it is",
  "a command, wrap it in a fenced ``` code block so it renders as code; use",
  "plain prose only for a non-command check; \"\" if none);",
  "`addresses` (the finding title(s) this step resolves).",
  "Where findings combine into an attack path (e.g. an exposed upload service",
  "plus a reachable web root), call it out and prioritize accordingly.",
  "Consolidate related findings into one step rather than repeating advice.",
  "Base everything strictly on the provided evidence — do not invent CVEs,",
  "services, or hosts that are not present.",
].join(" ");

/**
 * Generate an AI remediation plan for a parsed scan. Throws
 * `AiNotConfiguredError` when no API key is set, and rethrows OpenAI/parse
 * failures so the caller can keep the existing rule-based plan.
 */
export async function generateRemediationPlan(
  scan: Scan,
): Promise<RemediationPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  // OpenAI strict mode rejects the `$schema` key that Zod emits.
  const jsonSchema = z.toJSONSchema(RemediationOutputSchema) as Record<
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
      json_schema: { name: "remediation_plan", strict: true, schema: jsonSchema },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  const parsed = RemediationOutputSchema.parse(JSON.parse(raw));
  return { source: "ai", steps: parsed.steps };
}
