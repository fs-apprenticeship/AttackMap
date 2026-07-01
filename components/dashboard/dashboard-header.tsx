import { FileText, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Scan } from "@/lib/types";

import { AiGenerating } from "./ai-generating";
import { AiMarker, aiBorder } from "./ai-marker";
import type { DashboardFinding, RiskAssessment, getSummaryCards } from "./data";
import { Markdown } from "./markdown";
import { RiskScoreGauge } from "./risk-score-gauge";
import { StatCard } from "./stat-card";
import { TopExposures } from "./top-exposures";
import { formatDate } from "./utils";

// Inner panels are subtly shaded so they read as floating cards on the white
// container, without full-bleed dividers that would need to align across columns.
const panelClass = "rounded-md border bg-muted/40";

type DashboardHeaderProps = {
  activeScan: Scan;
  risk: RiskAssessment;
  findings: DashboardFinding[];
  stats: ReturnType<typeof getSummaryCards>;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
};

export function DashboardHeader({
  activeScan,
  risk,
  findings,
  stats,
  generating,
  error,
  onGenerate,
}: DashboardHeaderProps) {
  const isAi = activeScan.summary.source === "ai";
  // The emerald treatment is "earned": only once AI has authored the summary
  // (or is actively generating). A rule-based, XML-derived summary stays neutral.
  const aiActive = isAi || generating;

  return (
    <Card className="overflow-hidden py-0">
      {/* Top bar: scan metadata. */}
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <Badge
          variant="outline"
          className="rounded-md border-border text-muted-foreground"
        >
          {activeScan.filename}
        </Badge>
        {activeScan.scannedAt ? (
          <Badge
            variant="outline"
            className="rounded-md border-border text-muted-foreground"
          >
            Scanned {formatDate(activeScan.scannedAt)}
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className="rounded-md border-border text-muted-foreground"
        >
          Parsed {formatDate(activeScan.parsedAt)}
        </Badge>
      </div>

      {/* Scan title, full width so the panels below it form an aligned row. */}
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
          Attack surface summary for {activeScan.target}
        </h1>
      </div>

      {/* Body: explicit 2x2 grid. Putting Key Metrics and Top Exposures in the
          SAME grid row forces them to equal height, so their top and bottom
          edges align regardless of the summary/gauge heights above them. DOM
          order leads with the rail (risk before prose on mobile); explicit
          col/row placement forms the 2x2 on desktop. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-10 p-4 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        {/* Risk score — top right. */}
        <div className={cn(panelClass, "order-1 p-5 xl:col-start-2 xl:row-start-1")}>
          <RiskScoreGauge score={risk.score} level={risk.level} />
        </div>

        {/* Top exposures — bottom right. */}
        <div className={cn(panelClass, "order-2 p-5 xl:col-start-2 xl:row-start-2")}>
          <TopExposures findings={findings} />
        </div>

        {/* Executive summary — top left. Housed in an emerald-tinted AI panel
            that signals it's model-generated, with the generate/regenerate
            action sitting right above the prose. */}
        <div className="order-3 xl:col-start-1 xl:row-start-1">
          <div
            className={cn(
              "flex h-full flex-col rounded-lg border p-4 sm:p-5",
              aiActive
                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/70 dark:bg-emerald-950/20"
                : "border-border bg-muted/40",
              generating && aiBorder,
            )}
            aria-busy={generating}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                    aiActive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {aiActive ? (
                    <Sparkles className="size-3.5" />
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Summary
                </span>
                <AiMarker
                  generating={generating}
                  source={activeScan.summary.source}
                />
                {!aiActive ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Rule-based
                  </span>
                ) : null}
              </div>
              <Button
                size="sm"
                variant={isAi ? "outline" : "default"}
                onClick={onGenerate}
                disabled={generating}
                className="shrink-0"
              >
                {generating ? (
                  "Generating..."
                ) : isAi ? (
                  <>
                    <RefreshCw className="size-4" data-icon="inline-start" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" data-icon="inline-start" />
                    Generate AI summary
                  </>
                )}
              </Button>
            </div>

            {/* Fill the panel and center the summary so that when the grid
                stretches this panel to match the risk gauge beside it, any
                leftover space sits balanced rather than pooling at the bottom. */}
            <div className="flex flex-1 flex-col justify-center">
              <AiGenerating
                generating={generating}
                scan={activeScan}
                className="max-w-3xl"
              >
                <div aria-live="polite" aria-busy={generating}>
                  <Markdown content={activeScan.summary.executive} />
                </div>
              </AiGenerating>
              {error ? (
                <p className="mt-3 text-xs text-red-600">{error}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Key metrics — bottom left, shares a row with Top Exposures. */}
        <div
          className={cn(
            panelClass,
            "order-4 overflow-hidden xl:col-start-1 xl:row-start-2",
          )}
        >
          <div className="grid h-full grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
