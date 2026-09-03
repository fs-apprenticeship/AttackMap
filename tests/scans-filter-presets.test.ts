import { describe, expect, it } from "vitest";

import {
  deleteScansFilterPreset,
  parseScansFilterPresets,
  readScansFilterPresets,
  saveScansFilterPreset,
  scansFilterPresetsStorageKey,
  writeScansFilterPresets,
  type SavedScansFilterPreset,
} from "@/features/scans/list/scans-filter-presets";
import { defaultScansUrlState } from "@/features/scans/list/scans-url-state";

function preset(
  overrides: Partial<SavedScansFilterPreset> = {},
): SavedScansFilterPreset {
  return {
    id: "preset-1",
    name: "High risk",
    state: {
      ...defaultScansUrlState,
      query: "gateway",
      riskFilters: ["critical", "high"],
    },
    createdAt: "2026-07-29T12:00:00.000Z",
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("saved scan filter presets", () => {
  it("parses valid presets and orders them newest first", () => {
    expect(
      parseScansFilterPresets({
        version: 1,
        presets: [
          preset({ id: "older", createdAt: "2026-07-01T00:00:00.000Z" }),
          preset({
            id: "newer",
            name: "Recent",
            createdAt: "2026-07-02T00:00:00.000Z",
          }),
        ],
      }).map((item) => item.id),
    ).toEqual(["newer", "older"]);
  });

  it("rejects malformed payloads and storage failures safely", () => {
    expect(
      parseScansFilterPresets({ version: 1, presets: [{ name: "bad" }] }),
    ).toEqual([]);
    expect(readScansFilterPresets({ getItem: () => "not json" })).toEqual([]);
    expect(
      writeScansFilterPresets(
        {
          setItem: () => {
            throw new Error("blocked");
          },
        },
        [preset()],
      ),
    ).toBe(false);
  });

  it("writes canonical presets and reads them back", () => {
    const storage = memoryStorage();
    expect(writeScansFilterPresets(storage, [preset()])).toBe(true);
    expect(storage.getItem(scansFilterPresetsStorageKey)).toContain('"version":1');
    expect(readScansFilterPresets(storage)).toEqual([preset()]);
  });

  it("overwrites matching names case-insensitively and deletes by id", () => {
    const original = preset();
    const replacement = preset({
      id: "new-id",
      name: "HIGH RISK",
      state: { ...defaultScansUrlState, query: "new query" },
    });
    const next = saveScansFilterPreset([original], replacement);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: original.id,
      name: "HIGH RISK",
      state: replacement.state,
    });
    expect(deleteScansFilterPreset(next, original.id)).toEqual([]);
  });
});
