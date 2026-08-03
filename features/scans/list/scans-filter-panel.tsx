"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

import { severityOrder } from "@/features/scans/shared/utils";
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
import type { Severity } from "@/lib/types";

import {
  aiStatusLabels,
  dateRangeLabels,
  defaultAiStatusFilters,
  riskFilterLabels,
  sortLabels,
  type AiStatusFilter,
  type DateRangeFilter,
  type SortOption,
} from "./scans-list-data";
import { ScansFilterPresetsControl } from "./scans-filter-presets-control";
import type { ScansUrlState } from "./scans-url-state";

type ScansFilterPanelProps = {
  query: string;
  sort: SortOption;
  riskFilters: Severity[];
  aiStatusFilters: AiStatusFilter[];
  dateRange: DateRangeFilter;
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  searchResetKey: number;
  currentState: ScansUrlState;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onDateRangeChange: (range: DateRangeFilter) => void;
  onRiskFilterChange: (severity: Severity, checked: boolean) => void;
  onAiStatusFilterChange: (status: AiStatusFilter, checked: boolean) => void;
  onResetFilters: () => void;
  onApplyPreset: (state: ScansUrlState) => void;
};

const filterTriggerClass =
  "h-10 w-full justify-between rounded-md border-border bg-background px-3 text-foreground shadow-sm hover:bg-muted/40";
const selectTriggerClass =
  "h-10 min-h-10 w-full rounded-md border-border bg-background text-sm font-medium text-foreground shadow-sm hover:bg-muted/40 data-[size=default]:h-10 *:data-[slot=select-value]:gap-2";
const activeBadgeClass =
  "h-6 rounded-md border-border bg-background px-2 text-muted-foreground";

export function ScansFilterPanel({
  query,
  sort,
  riskFilters,
  aiStatusFilters,
  dateRange,
  filteredCount,
  totalCount,
  hasActiveFilters,
  searchResetKey,
  currentState,
  onQueryChange,
  onSortChange,
  onDateRangeChange,
  onRiskFilterChange,
  onAiStatusFilterChange,
  onResetFilters,
  onApplyPreset,
}: ScansFilterPanelProps) {
  const allRisksSelected = riskFilters.length === severityOrder.length;
  const allAiStatusesSelected =
    aiStatusFilters.length === defaultAiStatusFilters.length;
  const riskFilterLabel = allRisksSelected
    ? "Risk level"
    : riskFilters.length === 0
      ? "No risks"
      : riskFilters.length === 1
        ? riskFilterLabels[riskFilters[0]]
        : `${riskFilters.length} risks`;
  const aiStatusLabel = allAiStatusesSelected
    ? "AI status"
    : aiStatusFilters.length === 0
      ? "No AI status"
      : aiStatusFilters.length === 1
        ? aiStatusLabels[aiStatusFilters[0]]
        : `${aiStatusFilters.length} statuses`;

  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_180px]">
            <SearchInput
              key={`${searchResetKey}:${query}`}
              initialQuery={query}
              onQueryChange={onQueryChange}
            />

            <ScansFilterPresetsControl
              currentState={currentState}
              onApply={onApplyPreset}
            />

            <Select
              value={sort}
              onValueChange={(value) => onSortChange(value as SortOption)}
            >
              <SelectTrigger
                aria-label="Sort scans"
                className={selectTriggerClass}
              >
                <ArrowDownUp className="size-4 text-muted-foreground" />
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
                  <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{riskFilterLabel}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-auto rounded-md"
              >
                {severityOrder.map((severity) => {
                  const checked = riskFilters.includes(severity);

                  return (
                    <DropdownMenuItem
                      key={severity}
                      onSelect={(event) => {
                        event.preventDefault();
                        onRiskFilterChange(severity, !checked);
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
                  <Sparkles className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{aiStatusLabel}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-auto rounded-md"
              >
                {defaultAiStatusFilters.map((status) => {
                  const checked = aiStatusFilters.includes(status);

                  return (
                    <DropdownMenuItem
                      key={status}
                      onSelect={(event) => {
                        event.preventDefault();
                        onAiStatusFilterChange(status, !checked);
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
              onValueChange={(value) =>
                onDateRangeChange(value as DateRangeFilter)
              }
            >
              <SelectTrigger
                aria-label="Filter by parsed date"
                className={selectTriggerClass}
              >
                <CalendarDays className="size-4 text-muted-foreground" />
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

        <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              Showing {filteredCount} of {totalCount} scans
            </span>
            {!allRisksSelected && riskFilters.length === 0 ? (
              <Badge variant="outline" className={activeBadgeClass}>
                No risks
              </Badge>
            ) : null}
            {!allRisksSelected
              ? riskFilters.map((severity) => (
                  <Badge
                    key={severity}
                    variant="outline"
                    className={activeBadgeClass}
                  >
                    {riskFilterLabels[severity]}
                  </Badge>
                ))
              : null}
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
              className="h-8 self-start rounded-md px-2 text-muted-foreground hover:text-foreground sm:self-auto"
              onClick={onResetFilters}
            >
              <X className="size-4" />
              Clear filters
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SearchInput({
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
      <span className="sr-only">Search scans</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        placeholder="Search filename, target, host, service, or port"
        className="h-10 rounded-md pl-9"
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
}
