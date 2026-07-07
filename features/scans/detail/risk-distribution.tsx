import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SeverityBadge } from "./severity-badge";
import type { SeverityCount } from "@/lib/scans/metrics";

type RiskDistributionProps = {
  counts: SeverityCount[];
  description?: string;
  title?: string;
};

export function RiskDistribution({
  counts,
  description = "Findings grouped by severity",
  title = "Risk distribution",
}: RiskDistributionProps) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b p-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-1 gap-3 p-4">
        {counts.map(({ severity, count }) => (
          <Card key={severity} className="bg-muted/40 py-0">
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
