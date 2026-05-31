import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SeverityBadge } from "./severity-badge";
import type { SeverityCount } from "./data";

type RiskDistributionProps = {
  counts: SeverityCount[];
};

export function RiskDistribution({ counts }: RiskDistributionProps) {
  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardHeader className="border-b p-4">
        <CardTitle>Risk distribution</CardTitle>
        <CardDescription>Findings grouped by severity</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-4">
        {counts.map(({ severity, count }) => (
          <Card key={severity} className="rounded-md border bg-zinc-50 py-0">
            <CardContent className="p-3">
            <SeverityBadge severity={severity} />
            <p className="mt-4 text-2xl font-semibold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
