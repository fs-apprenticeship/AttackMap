import { CircleDot, Filter, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Scan } from "@/lib/types";

import { formatDate } from "./utils";

type DashboardHeaderProps = {
  activeScan: Scan;
};

export function DashboardHeader({ activeScan }: DashboardHeaderProps) {
  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardContent className="flex flex-col justify-between gap-4 p-5 xl:flex-row xl:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md bg-zinc-950 text-white">
              <CircleDot className="size-3" />
              Live dashboard preview
            </Badge>
            <Badge
              variant="outline"
              className="rounded-md border-zinc-200 text-zinc-600"
            >
              Parsed {formatDate(activeScan.parsedAt)}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
            Attack surface for {activeScan.filename}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            {activeScan.summary.executive}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block min-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="h-10 rounded-md border bg-white pl-9 pr-3"
              placeholder="Search hosts, ports, services"
            />
          </label>
          <Button
            variant="outline"
            className="h-10 justify-center rounded-md bg-white text-zinc-700"
          >
            <Filter className="size-4" />
            Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
