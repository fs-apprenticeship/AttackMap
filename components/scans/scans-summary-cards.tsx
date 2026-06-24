import { Clock3, FileWarning, ListChecks, ShieldAlert } from "lucide-react";

import { formatDate } from "@/components/dashboard/utils";
import { Card, CardContent } from "@/components/ui/card";

import type { ScanAggregateStats } from "./scans-list-data";

type ScansSummaryCardsProps = {
  stats: ScanAggregateStats;
};

const summaryCardClass =
  "rounded-md border border-zinc-200 bg-white py-0 shadow-sm";

export function ScansSummaryCards({ stats }: ScansSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-zinc-950 text-white">
            <ListChecks className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">
              Total scans
            </p>
            <p className="text-2xl font-semibold text-zinc-950">
              {stats.total}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-red-100 text-red-700">
            <FileWarning className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">
              High risk
            </p>
            <p className="text-2xl font-semibold text-zinc-950">
              {stats.highRiskScans}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <ShieldAlert className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">
              Findings
            </p>
            <p className="text-2xl font-semibold text-zinc-950">
              {stats.totalFindings}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-sky-100 text-sky-700">
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-zinc-500">
              Most recent
            </p>
            <p className="truncate text-xl text-zinc-950">
              {stats.mostRecent ? formatDate(stats.mostRecent) : "No scans"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
