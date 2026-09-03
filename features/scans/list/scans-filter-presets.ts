import { severityOrder } from "@/features/scans/shared/utils";

import {
  defaultAiStatusFilters,
  type DateRangeFilter,
  type SortOption,
} from "./scans-list-data";
import type { ScansUrlState } from "./scans-url-state";

export const scansFilterPresetsStorageKey =
  "attack-map:scans-filter-presets:v1";

export type SavedScansFilterPreset = {
  id: string;
  name: string;
  state: ScansUrlState;
  createdAt: string;
};

type PresetPayload = {
  version: 1;
  presets: SavedScansFilterPreset[];
};

const maxPresetNameLength = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function canonicalizeState(value: unknown): ScansUrlState | null {
  if (!isRecord(value) || typeof value.query !== "string") return null;
  if (!isStringArray(value.riskFilters) || !isStringArray(value.aiStatusFilters)) {
    return null;
  }
  if (typeof value.dateRange !== "string" || typeof value.sort !== "string") {
    return null;
  }

  const query = value.query.trim();
  const storedRiskFilters = value.riskFilters;
  const storedAiStatusFilters = value.aiStatusFilters;
  const riskFilters = severityOrder.filter((risk) =>
    storedRiskFilters.includes(risk),
  );
  const aiStatusFilters = defaultAiStatusFilters.filter((status) =>
    storedAiStatusFilters.includes(status),
  );
  const dateRange = value.dateRange as DateRangeFilter;
  const sort = value.sort as SortOption;

  if (
    query !== value.query ||
    riskFilters.length !== storedRiskFilters.length ||
    aiStatusFilters.length !== storedAiStatusFilters.length ||
    !riskFilters.every((risk, index) => risk === storedRiskFilters[index]) ||
    !aiStatusFilters.every(
      (status, index) => status === storedAiStatusFilters[index],
    ) ||
    !["all", "24h", "7d", "30d"].includes(dateRange) ||
    ![
      "parsed-desc",
      "parsed-asc",
      "risk-desc",
      "findings-desc",
      "hosts-desc",
      "target-asc",
    ].includes(sort)
  ) {
    return null;
  }

  return { query, riskFilters, aiStatusFilters, dateRange, sort };
}

function parsePreset(value: unknown): SavedScansFilterPreset | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (typeof value.name !== "string" || typeof value.createdAt !== "string") {
    return null;
  }

  const name = value.name.trim();
  const state = canonicalizeState(value.state);
  if (
    name.length === 0 ||
    name.length > maxPresetNameLength ||
    name !== value.name ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    !state
  ) {
    return null;
  }

  return { id: value.id, name, state, createdAt: value.createdAt };
}

function sortPresets(presets: SavedScansFilterPreset[]) {
  return [...presets].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function parseScansFilterPresets(value: unknown): SavedScansFilterPreset[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.presets)) {
    return [];
  }

  const presets = value.presets.map(parsePreset);
  return presets.some((preset) => preset === null)
    ? []
    : sortPresets(presets as SavedScansFilterPreset[]);
}

export function readScansFilterPresets(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(scansFilterPresetsStorageKey);
    return raw === null ? [] : parseScansFilterPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeScansFilterPresets(
  storage: Pick<Storage, "setItem">,
  presets: SavedScansFilterPreset[],
) {
  const normalized = parseScansFilterPresets({ version: 1, presets });
  if (normalized.length !== presets.length) return false;

  const payload: PresetPayload = { version: 1, presets: normalized };
  try {
    storage.setItem(scansFilterPresetsStorageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function saveScansFilterPreset(
  presets: SavedScansFilterPreset[],
  preset: SavedScansFilterPreset,
) {
  const name = preset.name.trim();
  const existing = presets.find(
    (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  const nextPreset = { ...preset, id: existing?.id ?? preset.id, name };

  return sortPresets([
    ...presets.filter((item) => item.id !== existing?.id),
    nextPreset,
  ]);
}

export function deleteScansFilterPreset(
  presets: SavedScansFilterPreset[],
  id: string,
) {
  return presets.filter((preset) => preset.id !== id);
}
