import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// The shared chrome for any structured block the assistant emits (CVE groups,
// evidence, recommendations). Mirrors the dashboard's card language — bordered,
// inset, calm — so assistant output reads as part of the product, not a chat
// bubble. An optional left accent stripe carries severity *only* when relevant.

export function ResponseCard({
  label,
  title,
  meta,
  accent,
  children,
  className,
}: {
  /** Small uppercase eyebrow, e.g. "CVE LOOKUP". */
  label?: string;
  title?: ReactNode;
  /** Right-aligned summary, e.g. "2 results · max 7.5". */
  meta?: ReactNode;
  /** Tailwind border-color class for the left stripe (severity-derived). */
  accent?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card/60",
        accent && "border-l-2",
        accent,
        className,
      )}
    >
      {(label || title || meta) && (
        <div className="flex items-start justify-between gap-3 px-3 pt-2.5 pb-2">
          <div className="min-w-0">
            {label ? (
              <p className="text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {label}
              </p>
            ) : null}
            {title ? (
              <div className="truncate text-sm font-medium text-foreground">
                {title}
              </div>
            ) : null}
          </div>
          {meta ? (
            <div className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
              {meta}
            </div>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
