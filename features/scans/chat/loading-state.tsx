"use client";

import { Crosshair } from "lucide-react";

// Shown after a question is sent but before the first token arrives. Replaces
// the generic "bouncing dots" with an instrument-like "acquiring" state: a
// reticle that holds, over a thin indeterminate scan line. Calm, not frantic.
export function LoadingState({ label = "Analyzing scan" }: { label?: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Crosshair className="size-4 shrink-0 animate-pulse text-emerald-600 motion-reduce:animate-none dark:text-emerald-400" />
        <span>{label}…</span>
      </div>
      <div className="h-px w-40 overflow-hidden rounded-full bg-border">
        <div className="ai-scanline h-full w-1/3 rounded-full bg-emerald-500/70" />
      </div>
    </div>
  );
}
