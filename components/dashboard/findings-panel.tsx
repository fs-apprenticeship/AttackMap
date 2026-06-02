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
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-zinc-700" />
          <CardTitle>Findings</CardTitle>
        </div>
        <CardDescription className="mt-1">
          Detected from the scan
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        {findings.length === 0 ? (
          <p className="text-sm text-zinc-500">No findings for this scan.</p>
        ) : (
          findings.map((finding) => (
            <Card
              key={finding.id}
              className="rounded-md border bg-zinc-50 py-0"
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{finding.title}</h3>
                  <SeverityBadge severity={finding.severity} />
                </div>
                {finding.evidence ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
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
