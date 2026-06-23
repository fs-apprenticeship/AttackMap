import { z } from "zod";

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
  protocol: z.string(),
  serviceName: z.string(),
  product: z.string().optional(),
  version: z.string().optional(),
  extrainfo: z.string().optional(),
  cpe: z.array(z.string()).default([]),
  riskLevel: RiskLevelSchema,
});

export const HostSchema = z.object({
  id: z.string(),
  ipAddress: z.string(),
  hostname: z.string().optional(),
  operatingSystem: z.string(),
  role: z.string(),
  internetExposed: z.boolean(),
  services: z.array(ServiceSchema),
});

export const FindingSchema = z.object({
  id: z.string(),
  hostId: z.string().optional(),
  host: z.string().optional(),
  severity: RiskLevelSchema,
  title: z.string(),
  evidence: z.string(),
  remediation: z.string(),
});

// Defined before AISummarySchema so the summary can embed remediationPlan.
export const RemediationStepSchema = z.object({
  priority: z.enum(["now", "next", "later"]),
  title: z.string(),
  summary: z.string(),
  steps: z.array(z.string()),
  commands: z.array(z.string()),
  verification: z.string(),
  addresses: z.array(z.string()),
});

export const RemediationPlanSchema = z.object({
  source: z.enum(["ai", "rule-based"]),
  steps: z.array(RemediationStepSchema),
});

export const AISummarySchema = z.object({
  executive: z.string(),
  riskScore: z.number(),
  riskLevel: RiskLevelSchema,
  topRisks: z.array(z.string()).default([]),
  remediationPlan: RemediationPlanSchema.optional(),
  source: z.enum(["ai", "rule-based"]),
});

export const ScanSchema = z.object({
  id: z.string(),
  filename: z.string(),
  target: z.string(),
  uploadedAt: z.string(),
  parsedAt: z.string(),
  scannedAt: z.string().optional(),
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
export type RemediationStep = z.infer<typeof RemediationStepSchema>;
export type RemediationPlan = z.infer<typeof RemediationPlanSchema>;
export type AISummary = z.infer<typeof AISummarySchema>;
export type Scan = z.infer<typeof ScanSchema>;
