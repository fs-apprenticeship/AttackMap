import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getScanCached } from "@/lib/scans/queries";

async function ScanDetail({ id }: { id: string }) {
  const scan = await getScanCached(id);

  if (!scan) {
    return (
      <Card className="rounded-md border bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm font-medium">Scan not found</p>
          <p className="max-w-sm text-sm text-zinc-500">
            This scan doesn't exist or belongs to another account.
          </p>
          <Button asChild className="mt-1 rounded-md">
            <Link href="/upload">Upload a scan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <Dashboard scan={scan} />;
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-5 flex items-center justify-between">
          <Button asChild variant="outline" className="rounded-md bg-white">
            <Link href="/scans">
              <ArrowLeft className="size-4" />
              All scans
            </Link>
          </Button>
          <Button asChild className="rounded-md">
            <Link href="/upload">
              <Plus className="size-4" />
              New scan
            </Link>
          </Button>
        </div>

        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <ScanDetail id={id} />
        </Suspense>
      </div>
    </main>
  );
}
