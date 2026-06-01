import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getScanStats } from "@/components/dashboard/data";
import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { formatDate } from "@/components/dashboard/utils";
import { DeleteScanDialog } from "@/components/scans/delete-scan-dialog";
import type { Scan } from "@/lib/types";

type ScanCardProps = {
  scan: Scan;
};

export function ScanCard({ scan }: ScanCardProps) {
  const stats = getScanStats(scan);

  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm transition-colors hover:border-zinc-400">
      <CardContent className="flex items-center gap-2 p-4">
        <Link href={`/scans/${scan.id}`} className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-zinc-950">
                {scan.filename}
              </p>
              <SeverityBadge severity={scan.summary.riskLevel} />
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {scan.target} · parsed {formatDate(scan.parsedAt)}
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              {stats.totalHosts} host{stats.totalHosts === 1 ? "" : "s"} ·{" "}
              {stats.openPorts} ports · {stats.findings} findings
            </p>
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-zinc-400" />
        </Link>
        <DeleteScanDialog scan={scan} />
      </CardContent>
    </Card>
  );
}
