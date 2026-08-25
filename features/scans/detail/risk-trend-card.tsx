"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useScanTrend } from "@/features/scans/hooks/use-scan-trend";
import { RiskTrendChart } from "./risk-trend-chart";

type RiskTrendCardProps = {
  target: string;
  currentScanId: string;
};

export function RiskTrendCard({ target, currentScanId }: RiskTrendCardProps) {
  const { points, loading, error } = useScanTrend(target);
  const [showTable, setShowTable] = useState(false);

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b p-4">
        <div>
          <CardTitle>Risk over time</CardTitle>
          <CardDescription>Every scan of this target, oldest to newest</CardDescription>
        </div>
        {points.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Show chart" : "Show table"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading scan history…</p>
        )}

        {!loading && error && (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load scan history: {error}</p>
        )}

        {!loading && !error && points.length < 2 && (
          <p className="text-sm text-muted-foreground">
            This is the only scan of this target so far. Upload another scan of the
            same target to start tracking risk over time.
          </p>
        )}

        {!loading && !error && points.length > 1 && !showTable && (
          <RiskTrendChart points={points} currentScanId={currentScanId} />
        )}

        {!loading && !error && points.length > 1 && showTable && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scan</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Risk score</TableHead>
                <TableHead>Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.scanId}>
                  <TableCell className="text-foreground">
                    {point.filename}
                    {point.scanId === currentScanId && (
                      <span className="ml-2 text-xs text-muted-foreground">(this scan)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(point.at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{point.riskScore}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{point.riskLevel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
