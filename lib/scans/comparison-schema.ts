import { z } from "zod";

import {
  FindingSchema,
  HostSchema,
  RiskLevelSchema,
  ServiceSchema,
} from "@/lib/nmap/schema";

export const ComparisonHostSchema = HostSchema.pick({
  id: true,
  ipAddress: true,
  hostname: true,
  operatingSystem: true,
  role: true,
  internetExposed: true,
}).extend({
  serviceCount: z.number(),
});

export const ComparisonServiceSchema = ServiceSchema.pick({
  port: true,
  protocol: true,
  serviceName: true,
  product: true,
  version: true,
  riskLevel: true,
}).extend({
  hostId: z.string(),
  hostLabel: z.string(),
});

export const ChangedServiceSchema = z.object({
  hostId: z.string(),
  hostLabel: z.string(),
  port: z.number(),
  protocol: z.string(),
  before: ComparisonServiceSchema,
  after: ComparisonServiceSchema,
  changedFields: z.array(
    z.enum(["serviceName", "product", "version", "riskLevel"]),
  ),
});

export const ComparisonFindingSchema = FindingSchema.pick({
  id: true,
  hostId: true,
  host: true,
  severity: true,
  title: true,
  evidence: true,
});

export const ComparisonWarningSchema = z.object({
  code: z.enum(["different_targets", "low_host_overlap"]),
  message: z.string(),
  severity: z.enum(["info", "warning"]),
});

export const ScanComparisonSchema = z.object({
  baseScanId: z.string(),
  comparisonScanId: z.string(),
  baseTarget: z.string(),
  comparisonTarget: z.string(),
  warnings: z.array(ComparisonWarningSchema),
  riskDelta: z.number(),
  riskBefore: z.number(),
  riskAfter: z.number(),
  highestSeverityBefore: RiskLevelSchema,
  highestSeverityAfter: RiskLevelSchema,
  newHosts: z.array(ComparisonHostSchema),
  removedHosts: z.array(ComparisonHostSchema),
  newServices: z.array(ComparisonServiceSchema),
  removedServices: z.array(ComparisonServiceSchema),
  changedServices: z.array(ChangedServiceSchema),
  newFindings: z.array(ComparisonFindingSchema),
  resolvedFindings: z.array(ComparisonFindingSchema),
});

export type ComparisonHost = z.infer<typeof ComparisonHostSchema>;
export type ComparisonService = z.infer<typeof ComparisonServiceSchema>;
export type ChangedService = z.infer<typeof ChangedServiceSchema>;
export type ComparisonFinding = z.infer<typeof ComparisonFindingSchema>;
export type ComparisonWarning = z.infer<typeof ComparisonWarningSchema>;
export type ScanComparison = z.infer<typeof ScanComparisonSchema>;
