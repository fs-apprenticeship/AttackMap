"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, ShieldAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { severityOrder } from "@/features/scans/shared/utils";
import type { Severity } from "@/lib/types";

import { SeverityBadge } from "./severity-badge";
import { filterFindings } from "./findings-data";
import {
  defaultFindingsUrlState,
  parseFindingsUrlState,
  type FindingsUrlState,
  writeFindingsUrlState,
} from "./findings-url-state";
import type { DashboardFinding } from "@/lib/scans/metrics";

type FindingsPanelProps = {
  findings: DashboardFinding[];
};

export function FindingsPanel({ findings }: FindingsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(
    () => parseFindingsUrlState(searchParams),
    [searchParams],
  );
  const { query, severityFilters } = urlState;
  const filteredFindings = useMemo(
    () =>
      filterFindings({
        findings,
        normalizedQuery: query,
        severityFilters,
      }),
    [findings, query, severityFilters],
  );
  const hasActiveFilters =
    query.trim().length > 0 || severityFilters.length !== severityOrder.length;
  const allSeveritiesSelected = severityFilters.length === severityOrder.length;
  const severityFilterLabel = allSeveritiesSelected
    ? "Severity"
    : severityFilters.length === 0
      ? "No severities"
      : severityFilters.length === 1
        ? severityFilters[0]
        : `${severityFilters.length} severities`;

  const replaceUrlState = useCallback(
    (nextState: FindingsUrlState) => {
      const nextParams = writeFindingsUrlState(
        new URLSearchParams(searchParams.toString()),
        nextState,
      );
      const queryString = nextParams.toString();

      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  function toggleSeverityFilter(severity: Severity, checked: boolean) {
    const nextSeverityFilters = checked
      ? severityFilters.includes(severity)
        ? severityFilters
        : [...severityFilters, severity]
      : severityFilters.filter((value) => value !== severity);

    replaceUrlState({ ...urlState, severityFilters: nextSeverityFilters });
  }

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
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <FindingsSearchInput
            key={query}
            initialQuery={query}
            onQueryChange={(nextQuery) =>
              replaceUrlState({ ...urlState, query: nextQuery })
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-label="Filter findings by severity"
                className="h-10 w-full justify-between rounded-md bg-background sm:w-44"
              >
                <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate capitalize">{severityFilterLabel}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto rounded-md">
              {severityOrder.map((severity) => {
                const checked = severityFilters.includes(severity);

                return (
                  <DropdownMenuItem
                    key={severity}
                    onSelect={(event) => {
                      event.preventDefault();
                      toggleSeverityFilter(severity, !checked);
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none"
                    />
                    <span className="capitalize">{severity}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              Showing {filteredFindings.length} of {findings.length} findings
            </span>
            {!allSeveritiesSelected
              ? severityFilters.map((severity) => (
                  <Badge
                    key={severity}
                    variant="outline"
                    className="h-6 rounded-md border-border bg-background px-2 capitalize text-muted-foreground"
                  >
                    {severity}
                  </Badge>
                ))
              : null}
          </div>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-md px-2 text-muted-foreground hover:text-foreground"
              onClick={() => replaceUrlState(defaultFindingsUrlState)}
            >
              <X className="size-4" />
              Clear filters
            </Button>
          ) : null}
        </div>

        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No findings for this scan.
          </p>
        ) : filteredFindings.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No findings match these filters.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust your search or severity selection to see findings.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 rounded-md bg-background"
              onClick={() => replaceUrlState(defaultFindingsUrlState)}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredFindings.map((finding) => (
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
                {finding.host ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Affected host: {finding.host}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FindingsSearchInput({
  initialQuery,
  onQueryChange,
}: {
  initialQuery: string;
  onQueryChange: (query: string) => void;
}) {
  const [draft, setDraft] = useState(initialQuery);

  useEffect(() => {
    if (draft === initialQuery) return;

    const timeout = window.setTimeout(() => onQueryChange(draft), 300);
    return () => window.clearTimeout(timeout);
  }, [draft, initialQuery, onQueryChange]);

  return (
    <label className="relative block">
      <span className="sr-only">Search findings</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        placeholder="Search title, evidence, or affected host"
        className="h-10 rounded-md pl-9"
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
}
