import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Scan } from "@/lib/types";

import { AiMarker, aiBorder } from "./ai-marker";
import { formatDate } from "./utils";

type DashboardHeaderProps = {
  activeScan: Scan;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
};

export function DashboardHeader({
  activeScan,
  generating,
  error,
  onGenerate,
}: DashboardHeaderProps) {
  const isAi = activeScan.summary.source === "ai";

  return (
    <Card
      className={cn(
        "rounded-md border bg-white py-0 shadow-sm",
        generating && aiBorder,
      )}
      aria-busy={generating}
    >
      <CardContent className="flex flex-col justify-between gap-4 p-5 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-md border-zinc-200 text-zinc-600"
            >
              {activeScan.filename}
            </Badge>
            {activeScan.scannedAt ? (
              <Badge
                variant="outline"
                className="rounded-md border-zinc-200 text-zinc-600"
              >
                Scanned {formatDate(activeScan.scannedAt)}
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className="rounded-md border-zinc-200 text-zinc-600"
            >
              Parsed {formatDate(activeScan.parsedAt)}
            </Badge>
            <AiMarker generating={generating} source={activeScan.summary.source} />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
            Attack surface summary for {activeScan.target}
          </h1>
          <p
            className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600"
            aria-live="polite"
          >
            {activeScan.summary.executive}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Button
            variant={isAi ? "outline" : "default"}
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Generating…
              </>
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
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
