import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types";

import type { DashboardFinding } from "@/lib/scans/metrics";
import { SeverityBadge } from "./severity-badge";

const TOP_LIMIT = 3;

const sectionLabel =
  "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

// Leading dot color per severity, mirroring the gauge ring / badge palette.
const dotClass: Record<Severity, string> = {
  critical: "bg-red-600",
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
  info: "bg-sky-500",
};

type TopExposuresProps = {
  // Expected pre-sorted by severity (see getScanFindings).
  findings: DashboardFinding[];
};

export function TopExposures({ findings }: TopExposuresProps) {
  const top = findings.slice(0, TOP_LIMIT);

  return (
    <div>
      <p className={sectionLabel}>Top exposures</p>
      {top.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {top.map((finding) => (
            <li key={finding.id} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  dotClass[finding.severity],
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {finding.title}
              </span>
              <SeverityBadge severity={finding.severity} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No exposures found.
        </p>
      )}
    </div>
  );
}
