"use client";

import { Download, Globe2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SeverityBadge } from "./severity-badge";
import {
  getHostHighestRisk,
  type HostWithScan,
} from "@/lib/scans/metrics";
import { formatRole } from "@/features/scans/shared/utils";
import { downloadTextFile } from "@/features/scans/shared/download";
import {
  exportFilename,
  serializeHostInventoryCsv,
} from "@/lib/scans/export";

type HostInventoryTableProps = {
  hosts: HostWithScan[];
  scanFilename: string;
};

export function HostInventoryTable({
  hosts,
  scanFilename,
}: HostInventoryTableProps) {
  function exportCsv() {
    try {
      downloadTextFile({
        content: serializeHostInventoryCsv(hosts),
        filename: exportFilename(scanFilename, "hosts.csv"),
        type: "text/csv;charset=utf-8",
        includeUtf8Bom: true,
      });
      toast.success("Host inventory exported");
    } catch {
      toast.error("Host inventory could not be exported");
    }
  }

  return (
    <Card className="py-0">
      <CardHeader className="border-b p-4 sm:grid-cols-[1fr_auto]">
        <div>
          <CardTitle>Host inventory</CardTitle>
          <CardDescription className="mt-1">
            Parsed assets with OS, role, exposure, and service risk
          </CardDescription>
        </div>
        <CardAction>
          <Button
            variant="outline"
            className="rounded-md bg-background text-foreground"
            size="lg"
            onClick={exportCsv}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[920px]">
          <TableHeader className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3 font-semibold">Host</TableHead>
              <TableHead className="px-4 py-3 font-semibold">OS</TableHead>
              <TableHead className="px-4 py-3 font-semibold">Role</TableHead>
              <TableHead className="px-4 py-3 font-semibold">Exposure</TableHead>
              <TableHead className="px-4 py-3 font-semibold">Services</TableHead>
              <TableHead className="px-4 py-3 font-semibold">
                Highest risk
              </TableHead>
              <TableHead className="px-4 py-3 font-semibold">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hosts.map((host) => {
              return (
                <TableRow key={host.id} className="hover:bg-muted/40">
                  <TableCell className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {host.hostname ?? host.ipAddress}
                    </div>
                    <div className="text-muted-foreground">{host.ipAddress}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {host.operatingSystem ?? "Unknown"}
                  </TableCell>
                  <TableCell className="px-4 py-3 capitalize text-muted-foreground">
                    {formatRole(host.role)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {host.internetExposed ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <Globe2 className="size-4" />
                        internet
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ShieldCheck className="size-4" />
                        internal
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {host.services.length}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <SeverityBadge severity={getHostHighestRisk(host)} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {host.scanFilename}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
