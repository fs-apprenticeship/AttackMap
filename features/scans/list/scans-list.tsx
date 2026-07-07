"use client";

import { useMemo, useState } from "react";

import type { Scan, Severity } from "@/lib/types";

import { ScansEmptyState } from "./scans-empty-state";
import { ScansFilterPanel } from "./scans-filter-panel";
import {
  defaultAiStatusFilters,
  defaultRiskFilters,
  filterAndSortScans,
  getAggregateStats,
  type AiStatusFilter,
  type DateRangeFilter,
  type SortOption,
} from "./scans-list-data";
import { ScansSummaryCards } from "./scans-summary-cards";
import { ScansTable } from "./scans-table";

type ScansListProps = {
  scans: Scan[];
};

export function ScansList({ scans }: ScansListProps) {
  const [query, setQuery] = useState("");
  const [riskFilters, setRiskFilters] =
    useState<Severity[]>(defaultRiskFilters);
  const [aiStatusFilters, setAiStatusFilters] = useState<AiStatusFilter[]>(
    defaultAiStatusFilters,
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [sort, setSort] = useState<SortOption>("parsed-desc");
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const aggregateStats = useMemo(() => getAggregateStats(scans), [scans]);
  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    riskFilters.length !== defaultRiskFilters.length ||
    aiStatusFilters.length !== defaultAiStatusFilters.length ||
    dateRange !== "all" ||
    sort !== "parsed-desc";

  const filteredScans = useMemo(
    () =>
      filterAndSortScans({
        scans,
        normalizedQuery,
        riskFilters,
        aiStatusFilters,
        dateRange,
        sort,
      }),
    [aiStatusFilters, dateRange, normalizedQuery, riskFilters, scans, sort],
  );

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

  function toggleExpandedScan(scanId: string) {
    setExpandedScanId((current) => (current === scanId ? null : scanId));
  }

  return (
    <div className="space-y-4">
      <ScansSummaryCards stats={aggregateStats} />

      <ScansFilterPanel
        query={query}
        sort={sort}
        riskFilters={riskFilters}
        aiStatusFilters={aiStatusFilters}
        dateRange={dateRange}
        filteredCount={filteredScans.length}
        totalCount={scans.length}
        hasActiveFilters={hasActiveFilters}
        onQueryChange={setQuery}
        onSortChange={setSort}
        onDateRangeChange={setDateRange}
        onRiskFilterChange={toggleRiskFilter}
        onAiStatusFilterChange={toggleAiStatusFilter}
        onResetFilters={resetFilters}
      />

      {filteredScans.length === 0 ? (
        <ScansEmptyState onResetFilters={resetFilters} />
      ) : (
        <ScansTable
          scans={filteredScans}
          expandedScanId={expandedScanId}
          onToggleExpanded={toggleExpandedScan}
        />
      )}
    </div>
  );
}
