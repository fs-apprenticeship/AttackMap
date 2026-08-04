import { severityOrder } from "@/features/scans/shared/utils";
import type { Severity } from "@/lib/types";

export type FindingsUrlState = {
  query: string;
  severityFilters: Severity[];
};

export const defaultFindingsUrlState: FindingsUrlState = {
  query: "",
  severityFilters: [...severityOrder],
};

function parseSeverityFilters(value: string | null): Severity[] {
  if (value === null) return [...severityOrder];
  if (value === "none") return [];

  const requested = new Set(value.split(","));
  const valid = severityOrder.filter((severity) => requested.has(severity));

  return valid.length > 0 ? valid : [...severityOrder];
}

export function parseFindingsUrlState(
  searchParams: Pick<URLSearchParams, "get">,
): FindingsUrlState {
  return {
    query: searchParams.get("q") ?? "",
    severityFilters: parseSeverityFilters(searchParams.get("severity")),
  };
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((item, i) => item === right[i]);
}

export function writeFindingsUrlState(
  currentParams: URLSearchParams,
  state: FindingsUrlState,
) {
  const params = new URLSearchParams(currentParams);
  const query = state.query.trim();
  const selected = new Set(state.severityFilters);
  const canonicalSeverities = severityOrder.filter((severity) =>
    selected.has(severity),
  );

  params.delete("q");
  params.delete("severity");

  if (query) params.set("q", query);

  if (!arraysEqual(canonicalSeverities, severityOrder)) {
    params.set(
      "severity",
      canonicalSeverities.length === 0 ? "none" : canonicalSeverities.join(","),
    );
  }

  return params;
}
