"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Scan, Severity } from "@/lib/types";

import { ScansEmptyState } from "./scans-empty-state";
import { ScansFilterPanel } from "./scans-filter-panel";
import {
  filterAndSortScans,
  getAggregateStats,
} from "./scans-list-data";
import {
  defaultScansUrlState,
  parseScansUrlState,
  type ScansUrlState,
  writeScansUrlState,
} from "./scans-url-state";
import { ScansSummaryCards } from "./scans-summary-cards";
import { ScansTable } from "./scans-table";

type ScansListProps = {
  scans: Scan[];
};

export function ScansList({ scans }: ScansListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(
    () => parseScansUrlState(searchParams),
    [searchParams],
  );
  const { query, riskFilters, aiStatusFilters, dateRange, sort } = urlState;
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const [searchResetKey, setSearchResetKey] = useState(0);

  const replaceUrlState = useCallback(
    (nextState: ScansUrlState) => {
      const nextParams = writeScansUrlState(
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

  const normalizedQuery = query.trim().toLowerCase();
  const aggregateStats = useMemo(() => getAggregateStats(scans), [scans]);
  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    riskFilters.length !== defaultScansUrlState.riskFilters.length ||
    aiStatusFilters.length !== defaultScansUrlState.aiStatusFilters.length ||
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
    const nextRiskFilters = checked
      ? riskFilters.includes(severity)
        ? riskFilters
        : [...riskFilters, severity]
      : riskFilters.filter((value) => value !== severity);

    replaceUrlState({ ...urlState, query, riskFilters: nextRiskFilters });
  }

  function toggleAiStatusFilter(
    status: ScansUrlState["aiStatusFilters"][number],
    checked: boolean,
  ) {
    const nextAiStatusFilters = checked
      ? aiStatusFilters.includes(status)
        ? aiStatusFilters
        : [...aiStatusFilters, status]
      : aiStatusFilters.filter((value) => value !== status);

    replaceUrlState({
      ...urlState,
      query,
      aiStatusFilters: nextAiStatusFilters,
    });
  }

  function resetFilters() {
    setSearchResetKey((current) => current + 1);
    replaceUrlState(defaultScansUrlState);
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
        searchResetKey={searchResetKey}
        currentState={urlState}
        onQueryChange={(nextQuery) =>
          replaceUrlState({ ...urlState, query: nextQuery })
        }
        onSortChange={(nextSort) =>
          replaceUrlState({ ...urlState, query, sort: nextSort })
        }
        onDateRangeChange={(nextDateRange) =>
          replaceUrlState({ ...urlState, query, dateRange: nextDateRange })
        }
        onRiskFilterChange={toggleRiskFilter}
        onAiStatusFilterChange={toggleAiStatusFilter}
        onResetFilters={resetFilters}
        onApplyPreset={replaceUrlState}
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
