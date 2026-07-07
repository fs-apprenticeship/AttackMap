import { Globe2, ShieldCheck } from "lucide-react";

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
import type { HostWithScan } from "@/lib/scans/metrics";
import { formatRole, severityOrder } from "@/features/scans/shared/utils";

type HostInventoryTableProps = {
  hosts: HostWithScan[];
};

export function HostInventoryTable({ hosts }: HostInventoryTableProps) {
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
          >
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
              const hostSeverity =
                severityOrder.find((severity) =>
                  host.services.some((service) => service.riskLevel === severity),
                ) ?? "info";

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
                    <SeverityBadge severity={hostSeverity} />
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
