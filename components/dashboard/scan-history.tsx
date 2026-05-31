import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Scan } from "@/lib/types";

import { getScanStats } from "./data";

type ScanHistoryProps = {
  scans: Scan[];
  activeScanId: string;
  onSelectScan: (scanId: string) => void;
};

export function ScanHistory({
  scans,
  activeScanId,
  onSelectScan,
}: ScanHistoryProps) {
  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Scan history
          </p>
          <Clock3 className="size-4 text-zinc-400" />
        </div>
        <div className="mt-3 space-y-2">
          {scans.map((scan) => {
            const isActive = scan.id === activeScanId;
            const stats = getScanStats(scan);

            return (
              <Button
                key={scan.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "h-auto w-full justify-start rounded-md border px-3 py-2 text-left",
                  isActive
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700",
                )}
                onClick={() => onSelectScan(scan.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {scan.filename}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-xs",
                      isActive ? "text-zinc-300" : "text-zinc-500",
                    )}
                  >
                    {stats.openPorts} ports · {stats.findings} findings
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
