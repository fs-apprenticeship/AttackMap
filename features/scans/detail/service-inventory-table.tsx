"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServiceWithHost } from "@/lib/scans/metrics";

import { SeverityBadge } from "./severity-badge";
import {
  defaultServiceSort,
  sortServices,
  toggleSort,
  type ServiceSortColumn,
} from "./inventory-table-data";
import { SortableTableHead } from "./sortable-table-head";

type ServiceInventoryTableProps = {
  services: ServiceWithHost[];
};

export function ServiceInventoryTable({ services }: ServiceInventoryTableProps) {
  const [sort, setSort] = useState(defaultServiceSort);
  const sortedServices = useMemo(
    () => sortServices(services, sort),
    [services, sort],
  );

  function sortBy(column: ServiceSortColumn) {
    setSort((current) => toggleSort(current, column));
  }

  function sortHead(column: ServiceSortColumn, label: string) {
    return (
      <SortableTableHead
        label={label}
        active={sort.column === column}
        direction={sort.direction}
        onSort={() => sortBy(column)}
      />
    );
  }

  return (
    <Card className="py-0">
      <CardHeader className="border-b p-4">
        <CardTitle>Service inventory</CardTitle>
        <CardDescription className="mt-1">
          Parsed open ports, detected products, and service risk
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table
          className="min-w-[1120px]"
          containerClassName="max-h-[60vh] overflow-auto"
        >
          <TableHeader className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <TableRow>
              {sortHead("host", "Host")}
              {sortHead("port", "Port")}
              {sortHead("protocol", "Protocol")}
              {sortHead("service", "Service")}
              {sortHead("product", "Product / version")}
              {sortHead("extraInfo", "Extra info")}
              {sortHead("risk", "Risk")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedServices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No services were detected for this scan.
                </TableCell>
              </TableRow>
            ) : null}
            {sortedServices.map((service) => {
              const product = [service.product, service.version]
                .filter(Boolean)
                .join(" ");

              return (
                <TableRow key={`${service.host.id}-${service.id}`} className="hover:bg-muted/40">
                  <TableCell className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {service.host.hostname ?? service.host.ipAddress}
                    </div>
                    <div className="text-muted-foreground">
                      {service.host.ipAddress}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-muted-foreground">
                    {service.port}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {service.protocol}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-foreground">
                    {service.serviceName || "Unknown"}
                  </TableCell>
                  <TableCell className="max-w-[280px] px-4 py-3 whitespace-normal text-muted-foreground">
                    {product || "Unknown"}
                  </TableCell>
                  <TableCell className="max-w-[320px] px-4 py-3 whitespace-normal text-muted-foreground">
                    {service.extrainfo || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <SeverityBadge severity={service.riskLevel} />
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
