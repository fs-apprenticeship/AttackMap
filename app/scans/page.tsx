import { Suspense } from "react";
import Link from "next/link";
import { FileUp, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScanCard } from "@/components/scans/scan-card";
import { listScansCached } from "@/lib/scans/queries";

async function ScansList() {
  const scans = await listScansCached();

  if (scans.length === 0) {
    return (
      <Card className="rounded-md border-dashed bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
            <FileUp className="size-5" />
          </div>
          <p className="text-sm font-medium">No scans yet</p>
          <p className="max-w-sm text-sm text-zinc-500">
            Upload an Nmap XML scan to get started.
          </p>
          <Button asChild className="mt-1 rounded-md">
            <Link href="/upload">Upload a scan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return scans.map((scan) => <ScanCard key={scan.id} scan={scan} />);
}

export default function ScansPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your scans</h1>
            <p className="mt-1 text-sm text-zinc-600">All saved scans.</p>
          </div>
          <Button asChild className="rounded-md">
            <Link href="/upload">
              <Plus className="size-4" />
              New scan
            </Link>
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <ScansList />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
