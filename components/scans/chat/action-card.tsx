"use client";

import { ArrowRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// A premium, full-width action the assistant can take. Unlike a prompt chip, it
// states *what happens* (title) and *why it's useful* (description), and reads
// as a deliberate control. Hover/focus reveal a forward affordance.
export function ActionCard({
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border bg-card/40 px-3 py-2.5 text-left",
        "transition-all duration-150 hover:border-emerald-500/40 hover:bg-card",
        "focus-visible:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:outline-none",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-emerald-500/10 text-emerald-600 transition-colors group-hover:border-emerald-500/40 dark:text-emerald-400">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
    </button>
  );
}
