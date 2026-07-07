// Normalized AttackMap domain model.
//
// The runtime shape and types are defined once in `lib/nmap/schema.ts` (as a
// Zod schema) so the parser, the API boundary, and the dashboard can never
// drift apart. This module simply re-exports the inferred types for UI code.

export type {
  RiskLevel,
  Severity,
  Service,
  Host,
  Finding,
  AISummary,
  RemediationStep,
  RemediationPlan,
  Scan,
} from "@/lib/nmap/schema";
