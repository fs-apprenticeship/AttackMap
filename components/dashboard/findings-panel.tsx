import { ShieldAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SeverityBadge } from "./severity-badge";
import type { DashboardFinding } from "./data";

type FindingsPanelProps = {
  findings: DashboardFinding[];
};

export function FindingsPanel({ findings }: FindingsPanelProps) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-muted-foreground" />
          <CardTitle>Findings</CardTitle>
        </div>
        <CardDescription className="mt-1">
          Detected from the scan
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No findings for this scan.
          </p>
        ) : (
          findings.map((finding) => (
            <Card
              key={finding.id}
              className="bg-muted/40 py-0"
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{finding.title}</h3>
                  <SeverityBadge severity={finding.severity} />
                </div>
                {finding.evidence ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {finding.evidence}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
