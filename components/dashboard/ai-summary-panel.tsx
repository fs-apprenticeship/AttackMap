import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SeverityBadge } from "./severity-badge";
import type { DashboardRisk } from "./data";

type AiSummaryPanelProps = {
  risks: DashboardRisk[];
};

export function AiSummaryPanel({ risks }: AiSummaryPanelProps) {
  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-emerald-600" />
          <CardTitle>AI summary</CardTitle>
        </div>
        <CardDescription className="mt-1">
          Prioritized from parsed scan evidence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {risks.map((risk) => (
          <Card key={risk.title} className="rounded-md border bg-zinc-50 py-0">
            <CardContent className="p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">{risk.title}</h3>
              <SeverityBadge severity={risk.severity} />
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{risk.evidence}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-800">
              {risk.remediation}
            </p>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
