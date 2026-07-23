import { Suspense } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FirstScanEmptyState } from "@/components/app-shell/app-state-common";
import { ScansList } from "@/features/scans/list/scans-list";
import { ScansContentSkeleton } from "@/features/scans/list/scans-skeletons";
import { ImportJobsBanner } from "@/features/scans/list/import-jobs-banner";
import { listScansCached, listImportJobsCached } from "@/lib/scans/queries";
import { triggerOpportunisticReconcile } from "@/lib/scans/reconcile-trigger";

export default function ScansPage() {
  triggerOpportunisticReconcile();

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review scan history, risk, findings, and follow-up actions.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button
              asChild
              variant="outline"
              className="w-full min-w-0 rounded-md sm:w-auto"
            >
              <Link href="/dashboard/compare">
                <ArrowRightLeft className="size-4" />
                Compare
              </Link>
            </Button>
            <Button
              asChild
              className="w-full min-w-0 rounded-md sm:w-auto"
            >
              <Link href="/dashboard/upload">
                <Plus className="size-4" />
                New scan
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <Suspense fallback={null}>
            <ImportJobsContent />
          </Suspense>
        </div>

        <div className="mt-4">
          <Suspense fallback={<ScansContentSkeleton />}>
            <ScansContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function ImportJobsContent() {
  const jobs = await listImportJobsCached();
  return <ImportJobsBanner jobs={jobs} />;
}

async function ScansContent() {
  const scans = await listScansCached();

  if (scans.length === 0) {
    return <FirstScanEmptyState />;
  }

  return <ScansList scans={scans} />;
}
