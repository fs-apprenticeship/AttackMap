"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { getScanStats } from "@/components/dashboard/data";
import { severityOrder } from "@/components/dashboard/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanCard } from "@/components/scans/scan-card";
import type { Scan, Severity } from "@/lib/types";

type ScansListProps = {
  scans: Scan[];
};

type SortOption =
  | "parsed-desc"
  | "parsed-asc"
  | "risk-desc"
  | "findings-desc"
  | "hosts-desc"
  | "target-asc";
type AiStatusFilter =
  | "summary-ai"
  | "summary-rule-based"
  | "remediation-ai"
  | "remediation-rule-based";
type DateRangeFilter = "all" | "24h" | "7d" | "30d";

const riskFilterLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const defaultRiskFilters = [...severityOrder];

const aiStatusLabels: Record<AiStatusFilter, string> = {
  "summary-ai": "AI summary",
  "summary-rule-based": "Rule-based summary",
  "remediation-ai": "AI remediation",
  "remediation-rule-based": "Rule-based remediation",
};

const defaultAiStatusFilters = Object.keys(
  aiStatusLabels,
) as AiStatusFilter[];

const dateRangeLabels: Record<DateRangeFilter, string> = {
  all: "All time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const dateRangeDays: Record<Exclude<DateRangeFilter, "all">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

const sortLabels: Record<SortOption, string> = {
  "parsed-desc": "Newest parsed",
  "parsed-asc": "Oldest parsed",
  "risk-desc": "Highest risk",
  "findings-desc": "Most findings",
  "hosts-desc": "Most hosts",
  "target-asc": "Target A-Z",
};

const riskRank = Object.fromEntries(
  severityOrder.map((severity, index) => [severity, severityOrder.length - index]),
) as Record<Severity, number>;

const filterTriggerClass =
  "h-10 w-full justify-between rounded-md border-zinc-200 bg-zinc-50 px-3 text-zinc-700 shadow-none hover:bg-white";
const selectTriggerClass =
  "h-10 min-h-10 w-full rounded-md border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-700 shadow-none hover:bg-white data-[size=default]:h-10 *:data-[slot=select-value]:gap-2";
const activeBadgeClass =
  "h-6 rounded-md border-zinc-200 bg-white px-2 text-zinc-600";

function getSearchText(scan: Scan) {
  return [
    scan.filename,
    scan.target,
    scan.summary.riskLevel,
    ...scan.hosts.flatMap((host) => [
      host.hostname,
      host.ipAddress,
      host.operatingSystem,
      host.role,
      ...host.services.flatMap((service) => [
        service.serviceName,
        service.product,
        service.version,
        String(service.port),
      ]),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function compareScans(a: Scan, b: Scan, sort: SortOption) {
  const aStats = getScanStats(a);
  const bStats = getScanStats(b);

  switch (sort) {
    case "parsed-asc":
      return new Date(a.parsedAt).getTime() - new Date(b.parsedAt).getTime();
    case "risk-desc":
      return riskRank[b.summary.riskLevel] - riskRank[a.summary.riskLevel];
    case "findings-desc":
      return bStats.findings - aStats.findings;
    case "hosts-desc":
      return bStats.totalHosts - aStats.totalHosts;
    case "target-asc":
      return a.target.localeCompare(b.target);
    case "parsed-desc":
    default:
      return new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime();
  }
}

function isWithinDateRange(scan: Scan, range: DateRangeFilter) {
  if (range === "all") return true;

  const parsedAt = new Date(scan.parsedAt).getTime();
  const cutoff = Date.now() - dateRangeDays[range] * 24 * 60 * 60 * 1000;
  return parsedAt >= cutoff;
}

export function ScansList({ scans }: ScansListProps) {
  const [query, setQuery] = useState("");
  const [riskFilters, setRiskFilters] =
    useState<Severity[]>(defaultRiskFilters);
  const [aiStatusFilters, setAiStatusFilters] = useState<AiStatusFilter[]>(
    defaultAiStatusFilters,
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [sort, setSort] = useState<SortOption>("parsed-desc");

  const normalizedQuery = query.trim().toLowerCase();
  const allRisksSelected = riskFilters.length === severityOrder.length;
  const allAiStatusesSelected =
    aiStatusFilters.length === defaultAiStatusFilters.length;
  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    !allRisksSelected ||
    !allAiStatusesSelected ||
    dateRange !== "all" ||
    sort !== "parsed-desc";
  const riskFilterLabel =
    allRisksSelected
      ? "Risk level"
      : riskFilters.length === 0
        ? "No risks"
      : riskFilters.length === 1
        ? riskFilterLabels[riskFilters[0]]
        : `${riskFilters.length} risks`;
  const aiStatusLabel =
    allAiStatusesSelected
      ? "AI status"
      : aiStatusFilters.length === 0
        ? "No AI status"
        : aiStatusFilters.length === 1
          ? aiStatusLabels[aiStatusFilters[0]]
          : `${aiStatusFilters.length} statuses`;

  const filteredScans = useMemo(() => {
    return scans
      .filter((scan) => {
        const matchesRisk = riskFilters.includes(scan.summary.riskLevel);
        const matchesAiSummary = aiStatusFilters.includes(
          scan.summary.source === "ai" ? "summary-ai" : "summary-rule-based",
        );
        const matchesAiRemediation = aiStatusFilters.includes(
          scan.remediationPlan.source === "ai"
            ? "remediation-ai"
            : "remediation-rule-based",
        );
        const matchesDate = isWithinDateRange(scan, dateRange);
        const matchesSearch =
          normalizedQuery.length === 0 ||
          getSearchText(scan).includes(normalizedQuery);

        return (
          matchesRisk &&
          matchesAiSummary &&
          matchesAiRemediation &&
          matchesDate &&
          matchesSearch
        );
      })
      .sort((a, b) => compareScans(a, b, sort));
  }, [aiStatusFilters, dateRange, normalizedQuery, riskFilters, scans, sort]);

  function toggleRiskFilter(severity: Severity, checked: boolean) {
    setRiskFilters((current) => {
      if (checked) {
        return current.includes(severity) ? current : [...current, severity];
      }

      return current.filter((value) => value !== severity);
    });
  }

  function toggleAiStatusFilter(status: AiStatusFilter, checked: boolean) {
    setAiStatusFilters((current) => {
      if (checked) {
        return current.includes(status) ? current : [...current, status];
      }

      return current.filter((value) => value !== status);
    });
  }

  function resetFilters() {
    setQuery("");
    setRiskFilters(defaultRiskFilters);
    setAiStatusFilters(defaultAiStatusFilters);
    setDateRange("all");
    setSort("parsed-desc");
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-md border border-zinc-200 bg-white py-0 shadow-sm">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="space-y-2">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="relative block">
                <span className="sr-only">Search scans</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={query}
                  placeholder="Search filename, target, host, service, or port"
                  className="h-10 rounded-md border-zinc-200 bg-zinc-50 pl-9 shadow-none transition-colors hover:bg-white focus-visible:bg-white"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <Select
                value={sort}
                onValueChange={(value) => setSort(value as SortOption)}
              >
                <SelectTrigger
                  aria-label="Sort scans"
                  className={selectTriggerClass}
                >
                  <ArrowDownUp className="size-4 text-zinc-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(sortLabels) as SortOption[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {sortLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Filter by risk"
                    className={filterTriggerClass}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ShieldAlert className="size-4 shrink-0 text-zinc-500" />
                      <span className="truncate">{riskFilterLabel}</span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-md">
                  {severityOrder.map((severity) => {
                    const checked = riskFilters.includes(severity);

                    return (
                      <DropdownMenuItem
                        key={severity}
                        onSelect={(event) => {
                          event.preventDefault();
                          toggleRiskFilter(severity, !checked);
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none"
                        />
                        {riskFilterLabels[severity]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Filter by AI status"
                    className={filterTriggerClass}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Sparkles className="size-4 shrink-0 text-zinc-500" />
                      <span className="truncate">{aiStatusLabel}</span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-zinc-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-md">
                  {defaultAiStatusFilters.map((status) => {
                    const checked = aiStatusFilters.includes(status);

                    return (
                      <DropdownMenuItem
                        key={status}
                        onSelect={(event) => {
                          event.preventDefault();
                          toggleAiStatusFilter(status, !checked);
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none"
                        />
                        {aiStatusLabels[status]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <Select
                value={dateRange}
                onValueChange={(value) => setDateRange(value as DateRangeFilter)}
              >
                <SelectTrigger
                  aria-label="Filter by parsed date"
                  className={selectTriggerClass}
                >
                  <CalendarDays className="size-4 text-zinc-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(dateRangeLabels) as DateRangeFilter[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {dateRangeLabels[value]}
                      </SelectItem>
                    ),
                )}
              </SelectContent>
            </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-zinc-700">
                Showing {filteredScans.length} of {scans.length} scans
              </span>
              {!allRisksSelected && riskFilters.length === 0 ? (
                <Badge variant="outline" className={activeBadgeClass}>
                  No risks
                </Badge>
              ) : null}
              {!allRisksSelected ? riskFilters.map((severity) => (
                <Badge
                  key={severity}
                  variant="outline"
                  className={activeBadgeClass}
                >
                  {riskFilterLabels[severity]}
                </Badge>
              )) : null}
              {!allAiStatusesSelected && aiStatusFilters.length === 0 ? (
                <Badge variant="outline" className={activeBadgeClass}>
                  No AI status
                </Badge>
              ) : null}
              {!allAiStatusesSelected
                ? aiStatusFilters.map((status) => (
                    <Badge
                      key={status}
                      variant="outline"
                      className={activeBadgeClass}
                    >
                      {aiStatusLabels[status]}
                    </Badge>
                  ))
                : null}
              {dateRange !== "all" ? (
                <Badge variant="outline" className={activeBadgeClass}>
                  {dateRangeLabels[dateRange]}
                </Badge>
              ) : null}
              {sort !== "parsed-desc" ? (
                <Badge variant="outline" className={activeBadgeClass}>
                  {sortLabels[sort]}
                </Badge>
              ) : null}
            </div>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 self-start rounded-md px-2 text-zinc-600 hover:text-zinc-950 sm:self-auto"
                onClick={resetFilters}
              >
                <X className="size-4" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {filteredScans.length === 0 ? (
        <Card className="rounded-md border-dashed bg-white py-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
              <SlidersHorizontal className="size-5" />
            </div>
            <p className="text-sm font-medium">No scans match these filters</p>
            <p className="max-w-sm text-sm text-zinc-500">
              Adjust the search, risk filter, or sort order to widen the list.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-1 rounded-md bg-white"
              onClick={resetFilters}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredScans.map((scan) => (
            <ScanCard key={scan.id} scan={scan} />
          ))}
        </div>
      )}
    </div>
  );
}