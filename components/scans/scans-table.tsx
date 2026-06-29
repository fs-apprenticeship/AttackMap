import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight, Network, Server } from "lucide-react";

import { getScanStats } from "@/components/dashboard/data";
import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { formatDate } from "@/components/dashboard/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Scan } from "@/lib/types";

import { DeleteScanDialog } from "./delete-scan-dialog";
import { getScanSeverityCounts, getTopFindings } from "./scans-list-data";

type ScansTableProps = {
  scans: Scan[];
  expandedScanId: string | null;
  onToggleExpanded: (scanId: string) => void;
};

export function ScansTable({
  scans,
  expandedScanId,
  onToggleExpanded,
}: ScansTableProps) {
  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="px-4">Filename</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Findings</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Parsed</TableHead>
            <TableHead className="w-[150px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scans.map((scan) => {
            const stats = getScanStats(scan);
            const severityCounts = getScanSeverityCounts(scan);
            const isExpanded = expandedScanId === scan.id;

            return (
              <Fragment key={scan.id}>
                <TableRow>
                  <TableCell className="max-w-[260px] px-4">
                    <Link
                      href={`/scans/${scan.id}`}
                      className="block truncate text-sm font-semibold text-foreground hover:underline"
                    >
                      {scan.filename}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[320px] whitespace-normal">
                    <span className="block truncate text-sm text-muted-foreground">
                      {scan.target}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={scan.summary.riskLevel} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {severityCounts.some(({ count }) => count > 0) ? (
                        severityCounts
                          .filter(({ count }) => count > 0)
                          .map(({ severity, count }) => (
                            <Badge
                              key={severity}
                              variant="outline"
                              className="h-6 rounded-md border-border bg-background px-2 text-muted-foreground"
                            >
                              {severity[0].toUpperCase()}
                              {count}
                            </Badge>
                          ))
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Server className="size-3.5" />
                        {stats.totalHosts}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Network className="size-3.5" />
                        {stats.openPorts}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(scan.parsedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-md text-muted-foreground"
                        aria-expanded={isExpanded}
                        onClick={() => onToggleExpanded(scan.id)}
                      >
                        Preview
                      </Button>
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        className="rounded-md text-muted-foreground"
                        aria-label={`Open ${scan.target} dashboard`}
                      >
                        <Link href={`/scans/${scan.id}`}>
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </Button>
                      <DeleteScanDialog scan={scan} />
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="bg-muted/30">
                    <TableCell
                      colSpan={7}
                      className="px-4 py-4 whitespace-normal"
                    >
                      <ScanPreview scan={scan} stats={stats} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function ScanPreview({
  scan,
  stats,
}: {
  scan: Scan;
  stats: ReturnType<typeof getScanStats>;
}) {
  const topFindings = getTopFindings(scan);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Top findings
        </p>
        {topFindings.length > 0 ? (
          <div className="mt-2 space-y-2">
            {topFindings.map((finding) => (
              <div
                key={finding.id}
                className="rounded-md border bg-card p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={finding.severity} />
                  <p className="text-sm font-medium text-foreground">
                    {finding.title}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {finding.evidence}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No findings were detected for this scan.
          </p>
        )}
      </div>
      <div className="rounded-md border bg-card p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Quick links
        </p>
        <div className="mt-3 grid gap-2">
          <Button asChild variant="outline" className="rounded-md bg-background">
            <Link href={`/scans/${scan.id}`}>Open dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md bg-background">
            <Link href={`/scans/${scan.id}/findings`}>Review findings</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-md bg-background">
            <Link href={`/scans/${scan.id}/hosts`}>View hosts</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {stats.webServices} web services, {stats.riskyServices} risky
          services, {stats.totalHosts} hosts in this scan.
        </p>
      </div>
    </div>
  );
}
