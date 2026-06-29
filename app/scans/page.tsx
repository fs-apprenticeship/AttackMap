import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FirstScanEmptyState } from "@/components/app-state-common";
import { ScansList } from "@/components/scans/scans-list";
import { ScansContentSkeleton } from "@/components/scans/scans-skeletons";
import { listScansCached } from "@/lib/scans/queries";

export default function ScansPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review scan history, risk, findings, and follow-up actions.
            </p>
          </div>
          <Button asChild className="rounded-md">
            <Link href="/upload">
              <Plus className="size-4" />
              New scan
            </Link>
          </Button>
        </div>

        <div className="mt-6">
          <Suspense fallback={<ScansContentSkeleton />}>
            <ScansContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function ScansContent() {
  const scans = await listScansCached();

  if (scans.length === 0) {
    return <FirstScanEmptyState />;
  }

  return <ScansList scans={scans} />;
}
