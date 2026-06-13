import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "cyan" | "amber" | "rose" | "emerald";
};

const toneClass: Record<StatCardProps["tone"], string> = {
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

// A borderless, centered stat cell. Sits in the metrics row beneath the
// executive summary, divided from its neighbours by the parent grid's dividers.
export function StatCard({ label, value, icon: Icon, tone }: StatCardProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
      <div className={cn("rounded-full border p-2.5", toneClass[tone])}>
        <Icon className="size-5" />
      </div>
      <p className="text-3xl font-semibold text-zinc-950">{value}</p>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
    </div>
  );
}
