import { Clock3, FileWarning, ListChecks, ShieldAlert } from "lucide-react";

import { formatDate } from "@/features/scans/shared/utils";
import { Card, CardContent } from "@/components/ui/card";

import type { ScanAggregateStats } from "./scans-list-data";

type ScansSummaryCardsProps = {
  stats: ScanAggregateStats;
};

const summaryCardClass = "py-0";

export function ScansSummaryCards({ stats }: ScansSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ListChecks className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Total scans
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.total}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <FileWarning className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              High risk
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.highRiskScans}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <ShieldAlert className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Findings
            </p>
            <p className="text-2xl font-semibold text-foreground">
              {stats.totalFindings}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className={summaryCardClass}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Most recent
            </p>
            <p className="truncate text-xl text-foreground">
              {stats.mostRecent ? formatDate(stats.mostRecent) : "No scans"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
