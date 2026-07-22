"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dismissImportJobAction } from "@/lib/scans/actions";
import { formatDate } from "@/features/scans/shared/utils";
import { cn } from "@/lib/utils";
import type { ScanImportJob } from "@/lib/scans/import-jobs";

const IN_PROGRESS_STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  validating: "Validating",
  parsing: "Parsing",
  saving: "Saving",
};

const POLL_INTERVAL_MS = 5000;

type ImportJobsBannerProps = {
  jobs: ScanImportJob[];
};

export function ImportJobsBanner({ jobs }: ImportJobsBannerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasInProgress = jobs.some((job) => job.status !== "failed");
  const seenStatusesRef = useRef<Map<string, ScanImportJob["status"]> | null>(null);

  useEffect(() => {
    if (!hasInProgress) return;
    const interval = setInterval(() => {
      startTransition(() => router.refresh());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasInProgress, router]);

  // Toast only newly-failed jobs (a status flip since the last render), not
  // ones that were already failed when this banner first mounted — those are
  // already visible in the list below.
  useEffect(() => {
    const seen = seenStatusesRef.current;
    if (seen) {
      for (const job of jobs) {
        if (job.status === "failed" && seen.get(job.id) !== "failed") {
          toast.error(`${job.filename} failed to import`, {
            description: job.errorMessage,
          });
        }
      }
    }
    seenStatusesRef.current = new Map(jobs.map((job) => [job.id, job.status]));
  }, [jobs]);

  if (jobs.length === 0) return null;

  function handleDismiss(jobId: string) {
    startTransition(async () => {
      try {
        await dismissImportJobAction(jobId);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to dismiss job";
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className={cn(
            "py-0",
            job.status === "failed" && "border-red-300 bg-red-50 dark:bg-red-950/20",
          )}
        >
          <CardContent className="flex items-center gap-3 p-4">
            {job.status === "failed" ? (
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
            ) : (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {job.filename}
                </p>
                <Badge
                  variant={job.status === "failed" ? "destructive" : "outline"}
                  className="rounded-md"
                >
                  {job.status === "failed"
                    ? "Import failed"
                    : IN_PROGRESS_STATUS_LABEL[job.status]}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {job.status === "failed"
                  ? (job.errorMessage ?? "The scan could not be imported.")
                  : `Started ${formatDate(job.createdAt)}`}
              </p>
            </div>
            {job.status === "failed" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Dismiss ${job.filename}`}
                className="shrink-0 rounded-md text-muted-foreground"
                onClick={() => handleDismiss(job.id)}
              >
                <X className="size-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
