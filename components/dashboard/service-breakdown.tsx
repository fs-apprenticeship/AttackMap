import { ArrowDownUp } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ServiceBreakdownItem } from "./data";

type ServiceBreakdownProps = {
  services: ServiceBreakdownItem[];
};

export function ServiceBreakdown({ services }: ServiceBreakdownProps) {
  const maxServiceCount = Math.max(1, ...services.map(([, count]) => count));

  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardHeader className="border-b p-4">
        <CardTitle>Service breakdown</CardTitle>
        <CardDescription>Detected services for this scan</CardDescription>
        <CardAction>
          <ArrowDownUp className="size-4 text-zinc-400" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {services.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No services were detected for this scan.
          </p>
        ) : (
          services.map(([service, count]) => (
            <div key={service}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{service}</span>
                <span className="text-zinc-500">{count}</span>
              </div>
              <div className="h-2 rounded-md bg-zinc-100">
                <div
                  className="h-2 rounded-md bg-cyan-600"
                  style={{ width: `${(count / maxServiceCount) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
