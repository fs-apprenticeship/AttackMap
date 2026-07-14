import { severityOrder } from "@/features/scans/shared/utils";
import type { Severity } from "@/lib/types";

import {
  defaultAiStatusFilters,
  defaultRiskFilters,
  type AiStatusFilter,
  type DateRangeFilter,
  type SortOption,
} from "./scans-list-data";

export type ScansUrlState = {
  query: string;
  riskFilters: Severity[];
  aiStatusFilters: AiStatusFilter[];
  dateRange: DateRangeFilter;
  sort: SortOption;
};

export const defaultScansUrlState: ScansUrlState = {
  query: "",
  riskFilters: [...defaultRiskFilters],
  aiStatusFilters: [...defaultAiStatusFilters],
  dateRange: "all",
  sort: "parsed-desc",
};

const dateRanges: DateRangeFilter[] = ["all", "24h", "7d", "30d"];
const sortOptions: SortOption[] = [
  "parsed-desc",
  "parsed-asc",
  "risk-desc",
  "findings-desc",
  "hosts-desc",
  "target-asc",
];

function parseList<T extends string>(
  value: string | null,
  allowed: readonly T[],
  defaults: readonly T[],
): T[] {
  if (value === null) return [...defaults];
  if (value === "none") return [];

  const requested = new Set(value.split(","));
  const valid = allowed.filter((item) => requested.has(item));

  return valid.length > 0 ? valid : [...defaults];
}

function parseValue<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value !== null && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function parseScansUrlState(
  searchParams: Pick<URLSearchParams, "get">,
): ScansUrlState {
  return {
    query: searchParams.get("q") ?? "",
    riskFilters: parseList(
      searchParams.get("risk"),
      severityOrder,
      defaultRiskFilters,
    ),
    aiStatusFilters: parseList(
      searchParams.get("ai"),
      defaultAiStatusFilters,
      defaultAiStatusFilters,
    ),
    dateRange: parseValue(searchParams.get("date"), dateRanges, "all"),
    sort: parseValue(searchParams.get("sort"), sortOptions, "parsed-desc"),
  };
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((item, i) => item === right[i]);
}

function writeList<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[],
  allowed: readonly T[],
  defaults: readonly T[],
) {
  const selected = new Set(values);
  const canonical = allowed.filter((value) => selected.has(value));

  if (arraysEqual(canonical, defaults)) {
    params.delete(key);
  } else {
    params.set(key, canonical.length === 0 ? "none" : canonical.join(","));
  }
}

export function writeScansUrlState(
  currentParams: URLSearchParams,
  state: ScansUrlState,
) {
  const params = new URLSearchParams(currentParams);
  const query = state.query.trim();

  for (const key of ["q", "risk", "ai", "date", "sort"]) {
    params.delete(key);
  }

  if (query) params.set("q", query);

  writeList(
    params,
    "risk",
    state.riskFilters,
    severityOrder,
    defaultRiskFilters,
  );
  writeList(
    params,
    "ai",
    state.aiStatusFilters,
    defaultAiStatusFilters,
    defaultAiStatusFilters,
  );

  if (state.dateRange === "all") params.delete("date");
  else params.set("date", state.dateRange);

  if (state.sort === "parsed-desc") params.delete("sort");
  else params.set("sort", state.sort);

  return params;
}
