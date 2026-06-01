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
import type { HostWithScan } from "./data";
import { formatRole, severityOrder } from "./utils";

type HostInventoryTableProps = {
  hosts: HostWithScan[];
};

export function HostInventoryTable({ hosts }: HostInventoryTableProps) {
  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
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
            className="rounded-md bg-white text-zinc-700"
            size="lg"
          >
            Export CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[920px]">
          <TableHeader className="bg-zinc-50 text-xs uppercase text-zinc-500">
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
                <TableRow key={host.id} className="hover:bg-zinc-50">
                  <TableCell className="px-4 py-3">
                    <div className="font-medium text-zinc-950">
                      {host.hostname ?? host.ipAddress}
                    </div>
                    <div className="text-zinc-500">{host.ipAddress}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-zinc-700">
                    {host.operatingSystem ?? "Unknown"}
                  </TableCell>
                  <TableCell className="px-4 py-3 capitalize text-zinc-700">
                    {formatRole(host.role)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {host.internetExposed ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <Globe2 className="size-4" />
                        internet
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-600">
                        <ShieldCheck className="size-4" />
                        internal
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-zinc-700">
                    {host.services.length}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <SeverityBadge severity={hostSeverity} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-zinc-500">
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
