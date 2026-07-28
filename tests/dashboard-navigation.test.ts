import { describe, expect, it } from "vitest";

import { isDashboardNavItemActive } from "@/components/app-shell/dashboard-navigation";

describe("dashboard navigation active state", () => {
  it("marks the scan list and nested scan routes as active", () => {
    expect(
      isDashboardNavItemActive("/dashboard/scans", "/dashboard/scans", true),
    ).toBe(true);
    expect(
      isDashboardNavItemActive(
        "/dashboard/scans/scan-123/findings",
        "/dashboard/scans",
        true,
      ),
    ).toBe(true);
  });

  it("does not let a prefix match an unrelated route", () => {
    expect(
      isDashboardNavItemActive(
        "/dashboard/scans-archive",
        "/dashboard/scans",
        true,
      ),
    ).toBe(false);
  });

  it("matches upload and compare routes exactly", () => {
    expect(
      isDashboardNavItemActive(
        "/dashboard/upload",
        "/dashboard/upload",
        false,
      ),
    ).toBe(true);
    expect(
      isDashboardNavItemActive(
        "/dashboard/upload/history",
        "/dashboard/upload",
        false,
      ),
    ).toBe(false);
    expect(
      isDashboardNavItemActive(
        "/dashboard/compare",
        "/dashboard/compare",
        false,
      ),
    ).toBe(true);
  });
});
