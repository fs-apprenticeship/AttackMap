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

export const AISummarySchema = z.object({
  executive: z.string(),
  riskScore: z.number(), // 0-100
  riskLevel: RiskLevelSchema,
  topRisks: z.array(z.string()),
  remediation: z.array(z.string()),
  source: z.enum(["ai", "rule-based"]),
});

export const ScanSchema = z.object({
  id: z.string(),
  filename: z.string(),
  target: z.string(), // best-effort label of what was scanned (hostname or ip)
  uploadedAt: z.string(), // ISO
  parsedAt: z.string(), // ISO
  hosts: z.array(HostSchema),
  findings: z.array(FindingSchema),
  summary: AISummarySchema,
});

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type Severity = RiskLevel;
export type Service = z.infer<typeof ServiceSchema>;
export type Host = z.infer<typeof HostSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type AISummary = z.infer<typeof AISummarySchema>;
export type Scan = z.infer<typeof ScanSchema>;
