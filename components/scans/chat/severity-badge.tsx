import { cn } from "@/lib/utils";
import type { CveSeverity } from "@/lib/ai/tools/lookup-cves";

// Severity is the one place color carries meaning in the assistant. These map
// CVSS severities to the dashboard's red / amber / emerald hues, but dark-aware
// (token-opacity fills) so they read in both themes. Reserved for findings and
// CVEs only — never used as chrome.
const SEVERITY_STYLES: Record<CveSeverity, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  none: "border-border bg-muted text-muted-foreground",
  unknown: "border-border bg-muted text-muted-foreground",
};

export function SeverityBadge({
  severity,
  score,
  className,
}: {
  severity: CveSeverity;
  score?: number | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold tabular-nums uppercase",
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      {typeof score === "number" ? score.toFixed(1) : null}
      <span className="tracking-wide">{severity}</span>
    </span>
  );
}
