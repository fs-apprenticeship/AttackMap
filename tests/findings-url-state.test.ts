import { describe, expect, it } from "vitest";

import {
  defaultFindingsUrlState,
  parseFindingsUrlState,
  writeFindingsUrlState,
} from "@/features/scans/detail/findings-url-state";

describe("findings URL state", () => {
  it("uses defaults when findings parameters are absent", () => {
    expect(parseFindingsUrlState(new URLSearchParams("from=dashboard"))).toEqual(
      defaultFindingsUrlState,
    );
  });

  it("parses valid severities in canonical order and ignores duplicates", () => {
    expect(
      parseFindingsUrlState(
        new URLSearchParams("q=SSH&severity=low,critical,low"),
      ),
    ).toEqual({ query: "SSH", severityFilters: ["critical", "low"] });
  });

  it("falls back to all severities for a wholly invalid selection", () => {
    expect(
      parseFindingsUrlState(new URLSearchParams("severity=unknown")),
    ).toEqual(defaultFindingsUrlState);
  });

  it("represents an explicitly empty severity selection with none", () => {
    expect(
      parseFindingsUrlState(new URLSearchParams("severity=none")),
    ).toEqual({ query: "", severityFilters: [] });
  });

  it("writes only non-default state and preserves unrelated parameters", () => {
    expect(
      writeFindingsUrlState(
        new URLSearchParams("from=dashboard&severity=high"),
        { query: " edge proxy ", severityFilters: ["low", "critical"] },
      ).toString(),
    ).toBe("from=dashboard&q=edge+proxy&severity=critical%2Clow");
  });

  it("clears only findings parameters when defaults are written", () => {
    expect(
      writeFindingsUrlState(
        new URLSearchParams("from=dashboard&q=ssh&severity=none"),
        defaultFindingsUrlState,
      ).toString(),
    ).toBe("from=dashboard");
  });
});
