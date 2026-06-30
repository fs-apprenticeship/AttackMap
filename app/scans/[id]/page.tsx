import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Plus } from "lucide-react";

import { Dashboard } from "@/components/dashboard/dashboard";
import { useScanDetail } from "./scan-detail-context";

async function ScanDetail({ id }: { id: string }) {
  const scan = await getScanCached(id);

  if (!scan) {
    return (
      <Card className="rounded-md border bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm font-medium">Scan not found</p>
          <p className="max-w-sm text-sm text-zinc-500">
            This scan doesn&apos;t exist or belongs to another account.
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

export default function ScanDetailPage() {
  const scan = useScanDetail();

  return <Dashboard scan={scan} />;
}
