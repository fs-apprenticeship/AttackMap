import type { RiskLevel, Severity } from "@/lib/types";

export const severityOrder: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

// Shared hex per risk level, for contexts (SVG stroke/fill) that can't take a
// Tailwind class — the gauge's ring and the trend chart's line markers, so a
// risk level reads as the same color everywhere it appears.
export const riskLevelColor: Record<RiskLevel, string> = {
  critical: "#dc2626", // red-600
  high: "#ef4444", // red-500
  medium: "#f59e0b", // amber-500
  low: "#10b981", // emerald-500
  info: "#0ea5e9", // sky-500
};
