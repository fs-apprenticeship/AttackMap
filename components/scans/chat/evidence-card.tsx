import { cn } from "@/lib/utils";

// A monospace "receipt" line — what the assistant actually queried or observed.
// Used inside CVE results to show provenance (the exact CPE / product sent to
// NVD), reinforcing that answers come from real lookups, not memory.
export function EvidenceCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 rounded-md border border-dashed bg-muted/40 px-2.5 py-1.5",
        className,
      )}
    >
      <span className="shrink-0 text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <code className="truncate font-mono text-xs text-foreground/80">{value}</code>
    </div>
  );
}
