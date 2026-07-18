import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";

import { ScanComparisonView } from "@/features/scans/scan-comparison-view";
import { Button } from "@/components/ui/button";
import { listScansCached } from "@/lib/scans/queries";
import { triggerOpportunisticReconcile } from "@/lib/scans/reconcile-trigger";

type CompareSearchParams = Promise<{ base?: string; comparison?: string }>;

export default function ComparePage({
  searchParams,
}: {
  searchParams: CompareSearchParams;
}) {
  triggerOpportunisticReconcile();

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="outline" className="mb-4 rounded-md bg-background">
              <Link href="/scans">
                <ArrowLeft className="size-4" />
                All scans
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">
              Compare scans
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Validate parser output across saved scans and review host, service,
              finding, and risk changes.
            </p>
          </div>
          <Button asChild className="rounded-md">
            <Link href="/upload">
              <FileUp className="size-4" />
              Upload scan
            </Link>
          </Button>
        </div>

        <Suspense fallback={<CompareSkeleton />}>
          <CompareContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function CompareContent({
  searchParams,
}: {
  searchParams: CompareSearchParams;
}) {
  const [scans, params] = await Promise.all([listScansCached(), searchParams]);

  return (
    <ScanComparisonView
      scans={scans}
      initialBaseScanId={params.base}
      initialComparisonScanId={params.comparison}
    />
  );
}

function CompareSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-24 rounded-md border bg-card" />
      <div className="h-64 rounded-md border bg-card" />
    </div>
  );
}
