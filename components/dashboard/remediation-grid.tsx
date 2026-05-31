import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { DashboardRemediation } from "./data";
import { priorityClass } from "./utils";

type RemediationGridProps = {
  remediation: DashboardRemediation[];
};

export function RemediationGrid({ remediation }: RemediationGridProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-3">
      {remediation.map((item) => (
        <Card key={item.title} className="rounded-md border bg-white py-0 shadow-sm">
          <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <Badge
              className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold uppercase",
                priorityClass[item.priority],
              )}
            >
              {item.priority}
            </Badge>
            <CheckCircle2 className="size-4 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {item.description}
          </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
