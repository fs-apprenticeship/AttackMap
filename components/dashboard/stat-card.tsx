import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: "cyan" | "amber" | "rose" | "emerald";
};

const toneClass: Record<StatCardProps["tone"], string> = {
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: StatCardProps) {
  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
          <div className={cn("rounded-md border p-2", toneClass[tone])}>
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-4 text-sm text-zinc-600">{detail}</p>
      </CardContent>
    </Card>
  );
}
