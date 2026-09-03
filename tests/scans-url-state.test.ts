import { describe, expect, it } from "vitest";

import {
  defaultScansUrlState,
  parseScansUrlState,
  writeScansUrlState,
} from "@/features/scans/list/scans-url-state";

describe("scan list URL state", () => {
  it("uses scan list defaults when filter parameters are absent", () => {
    expect(parseScansUrlState(new URLSearchParams("from=dashboard"))).toEqual(
      defaultScansUrlState,
    );
  });

  it("parses valid values, removes duplicates, and retains canonical order", () => {
    const params = new URLSearchParams(
      "q=proxy&risk=low,critical,low&ai=remediation-ai,summary-ai&date=7d&sort=risk-desc",
    );

    expect(parseScansUrlState(params)).toEqual({
      query: "proxy",
      riskFilters: ["critical", "low"],
      aiStatusFilters: ["summary-ai", "remediation-ai"],
      dateRange: "7d",
      sort: "risk-desc",
    });
  });

  it("keeps valid list entries and falls back for wholly invalid values", () => {
    expect(
      parseScansUrlState(
        new URLSearchParams(
          "risk=critical,unknown&ai=unknown&date=yesterday&sort=random",
        ),
      ),
    ).toEqual({
      ...defaultScansUrlState,
      riskFilters: ["critical"],
    });
  });

  it("represents explicitly empty multi-select filters with none", () => {
    expect(
      parseScansUrlState(new URLSearchParams("risk=none&ai=none")),
    ).toEqual({
      ...defaultScansUrlState,
      riskFilters: [],
      aiStatusFilters: [],
    });
  });

  it("writes only non-default state and preserves unrelated parameters", () => {
    const params = writeScansUrlState(
      new URLSearchParams("from=dashboard&risk=high"),
      {
        query: "edge proxy",
        riskFilters: ["low", "critical"],
        aiStatusFilters: [],
        dateRange: "30d",
        sort: "target-asc",
      },
    );

    expect(params.toString()).toBe(
      "from=dashboard&q=edge+proxy&risk=critical%2Clow&ai=none&date=30d&sort=target-asc",
    );
  });

  it("clears only scan-list parameters when defaults are written", () => {
    const params = writeScansUrlState(
      new URLSearchParams(
        "from=dashboard&q=proxy&risk=none&ai=summary-ai&date=24h&sort=hosts-desc",
      ),
      defaultScansUrlState,
    );

    expect(params.toString()).toBe("from=dashboard");
  });

  it("round-trips non-default state through its canonical URL", () => {
    const state = {
      query: "gateway",
      riskFilters: ["critical", "medium"] as const,
      aiStatusFilters: ["summary-ai", "remediation-rule-based"] as const,
      dateRange: "24h" as const,
      sort: "findings-desc" as const,
    };

    const params = writeScansUrlState(new URLSearchParams(), {
      ...state,
      riskFilters: [...state.riskFilters],
      aiStatusFilters: [...state.aiStatusFilters],
    });

    expect(parseScansUrlState(params)).toEqual(state);
  });

  it("applies a saved state without discarding unrelated parameters", () => {
    const params = writeScansUrlState(
      new URLSearchParams("from=dashboard&q=old&risk=high"),
      {
        query: "gateway",
        riskFilters: ["critical", "medium"],
        aiStatusFilters: [],
        dateRange: "7d",
        sort: "findings-desc",
      },
    );

    expect(params.toString()).toBe(
      "from=dashboard&q=gateway&risk=critical%2Cmedium&ai=none&date=7d&sort=findings-desc",
    );
  });
});
