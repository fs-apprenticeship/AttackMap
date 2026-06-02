import { z } from "zod";

// Canonical AttackMap domain model. This Zod schema is the single source of
// truth for the parsed scan shape; `lib/types.ts` re-exports the inferred types
// for the UI so the parser output and the dashboard always agree.

export const RiskLevelSchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const ServiceSchema = z.object({
  id: z.string(),
  port: z.number(),
  protocol: z.string(), // "tcp" | "udp"
  serviceName: z.string(), // nmap service name, e.g. "ssh", "http"
  product: z.string().optional(),
  version: z.string().optional(),
  extrainfo: z.string().optional(),
  riskLevel: RiskLevelSchema,
});

export const HostSchema = z.object({
  id: z.string(),
  ipAddress: z.string(),
  hostname: z.string().optional(),
  operatingSystem: z.string(), // derived, e.g. "Linux (Ubuntu)" or "Unknown"
  role: z.string(), // derived, e.g. "domain_controller", "web_server"
  internetExposed: z.boolean(),
  services: z.array(ServiceSchema),
});

export const FindingSchema = z.object({
  id: z.string(),
  hostId: z.string().optional(), // host the finding relates to (omitted for scan-wide)
  host: z.string().optional(), // human label (ip / hostname) for display
  severity: RiskLevelSchema,
  title: z.string(),
  evidence: z.string(),
  remediation: z.string(),
});

// Executive overview. `riskScore`/`riskLevel` are always rule-based
// (deterministic); `source` tracks whether the `executive` prose is the
// rule-based template or AI-generated.
export const AISummarySchema = z.object({
  executive: z.string(),
  riskScore: z.number(), // 0-100, rule-based
  riskLevel: RiskLevelSchema, // rule-based
  source: z.enum(["ai", "rule-based"]),
});

// One step of the remediation plan, structured documentation-style. The
// rule-based plan fills only `summary` (the canned remediation); the AI plan is
// context-aware and fills every section. Stored structured (not as a markdown
// blob) so it stays queryable and re-renderable — see [[roadmap-db-auth]].
export const RemediationStepSchema = z.object({
  priority: z.enum(["now", "next", "later"]),
  title: z.string(), // short imperative action
  summary: z.string(), // what & why, 1-2 sentences
  steps: z.array(z.string()), // ordered actions (may contain inline `code`)
  commands: z.array(z.string()), // commands/config, each rendered as a code block
  verification: z.string(), // how to confirm the fix ("" if none)
  addresses: z.array(z.string()), // finding titles this step resolves
});

export const RemediationPlanSchema = z.object({
  source: z.enum(["ai", "rule-based"]),
  steps: z.array(RemediationStepSchema),
});

export const ScanSchema = z.object({
  id: z.string(),
  filename: z.string(),
  target: z.string(), // best-effort label of what was scanned (hostname or ip)
  uploadedAt: z.string(), // ISO
  parsedAt: z.string(), // ISO
  scannedAt: z.string().optional(), // ISO; when nmap ran the scan (from <nmaprun start>)
  hosts: z.array(HostSchema),
  findings: z.array(FindingSchema),
  summary: AISummarySchema,
  remediationPlan: RemediationPlanSchema,
});

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type Severity = RiskLevel;
export type Service = z.infer<typeof ServiceSchema>;
export type Host = z.infer<typeof HostSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type AISummary = z.infer<typeof AISummarySchema>;
export type RemediationStep = z.infer<typeof RemediationStepSchema>;
export type RemediationPlan = z.infer<typeof RemediationPlanSchema>;
export type Scan = z.infer<typeof ScanSchema>;
