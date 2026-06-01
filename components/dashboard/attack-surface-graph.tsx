import { Server, TerminalSquare } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Host } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SeverityBadge } from "./severity-badge";
import { formatRole, nodeClass } from "./utils";

type AttackSurfaceGraphProps = {
  host: Host;
};

export function AttackSurfaceGraph({ host }: AttackSurfaceGraphProps) {
  const visibleServices = host.services.slice(0, 10);

  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Attack surface graph</CardTitle>
          <CardDescription className="mt-1">
            {host.hostname ?? host.ipAddress} with exposed services
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" />
            high
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            medium
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            low
          </span>
        </div>
      </CardHeader>

      <CardContent className="grid min-h-[430px] gap-5 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:28px_28px] p-5 lg:grid-cols-[260px_1fr]">
        <div className="flex items-center">
          <Card className="w-full rounded-md border-2 border-zinc-900 bg-zinc-950 py-0 text-white shadow-sm">
            <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Server className="size-6" />
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium">
                {host.operatingSystem}
              </span>
            </div>
            <p className="mt-5 truncate text-lg font-semibold">
              {host.hostname ?? host.ipAddress}
            </p>
            <p className="mt-1 text-sm text-zinc-300">{host.ipAddress}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
                {formatRole(host.role)}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
                {host.services.length} services
              </span>
            </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-center gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleServices.map((service) => (
            <Card
              key={service.id}
              className={cn(
                "rounded-md border py-0 shadow-sm",
                nodeClass[service.riskLevel],
              )}
            >
              <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <TerminalSquare className="mt-0.5 size-4 shrink-0" />
                <SeverityBadge severity={service.riskLevel} />
              </div>
              <p className="mt-3 text-sm font-semibold">
                {service.port}/{service.protocol}
              </p>
              <p className="mt-1 truncate text-sm">{service.serviceName}</p>
              <p className="mt-2 line-clamp-2 text-xs opacity-75">
                {[service.product, service.version].filter(Boolean).join(" ") ||
                  "No product fingerprint"}
              </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
