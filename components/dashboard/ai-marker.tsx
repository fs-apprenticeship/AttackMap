import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AISummary } from "@/lib/types";

type AiMarkerProps = {
  generating: boolean;
  source: AISummary["source"];
  className?: string;
};

const base =
  "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700";

/**
 * Unified "AI content" signal. While the AI runs it shows a pulsing
 * "Generating…" tag; once the content is AI-authored it shows a persistent
 * "AI" chip. Renders nothing for rule-based content, so the contrast makes it
 * clear which elements AI touched. Pulse respects `prefers-reduced-motion`.
 */
export function AiMarker({ generating, source, className }: AiMarkerProps) {
  if (generating) {
    return (
      <span
        className={cn(base, "animate-pulse motion-reduce:animate-none", className)}
      >
        <Sparkles className="size-3" />
        Generating…
      </span>
    );
  }

  if (source === "ai") {
    return (
      <span className={cn(base, className)}>
        <Sparkles className="size-3" />
        AI
      </span>
    );
  }

  return null;
}

/** Soft emerald border that breathes around an AI element while its content is
 * generating. Apply to a rounded container; see `.ai-ring` in globals.css. */
export const aiBorder = "ai-ring";
