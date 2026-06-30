import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";

import { ScanComparisonView } from "@/components/scans/scan-comparison-view";
import { Button } from "@/components/ui/button";
import { listScansCached } from "@/lib/scans/queries";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string; comparison?: string }>;
}) {
  const [scans, params] = await Promise.all([listScansCached(), searchParams]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="outline" className="mb-4 rounded-md bg-white">
              <Link href="/scans">
                <ArrowLeft className="size-4" />
                All scans
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">
              Compare scans
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
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

        <ScanComparisonView
          scans={scans}
          initialBaseScanId={params.base}
          initialComparisonScanId={params.comparison}
        />
      </div>
    </main>
  );
}
