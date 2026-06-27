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
    <Card className="py-0 transition-colors hover:border-ring/50">
      <CardContent className="flex items-center gap-2 p-4">
        <Link
          href={`/scans/${scan.id}`}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {scan.filename}
              </p>
              <SeverityBadge severity={scan.summary.riskLevel} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {scan.target} · parsed {formatDate(scan.parsedAt)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {stats.totalHosts} host{stats.totalHosts === 1 ? "" : "s"} ·{" "}
              {stats.openPorts} ports · {stats.findings} findings
            </p>
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <DeleteScanDialog scan={scan} />
      </CardContent>
    </Card>
  );
}
