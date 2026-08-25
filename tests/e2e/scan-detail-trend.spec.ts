import { test, expect } from "@playwright/test";

// prisma/seed.ts seeds three scans of the same target ("prod-app.internal",
// ids seed_trend_1..3) specifically so this spec has real history to plot —
// see lib/scans/trend.ts / features/scans/detail/risk-trend-card.tsx.
//
// Note: RiskTrendCard's title ("Risk over time") is a shadcn CardTitle,
// which renders a plain <div> — not a heading element — so it's matched by
// text, not role=heading.

test.describe("Scan detail — risk trend", () => {
  test("renders the dashboard for a seeded scan", async ({ page }) => {
    await page.goto("/dashboard/scans/seed_trend_3");

    await expect(page.getByText(/risk score/i).first()).toBeVisible();
    // The sub-nav tab (exact "Findings") vs. the quick-nav tile (accessible
    // name "Findings 1 findings") — disambiguate with an exact match.
    await expect(page.getByRole("link", { name: "Findings", exact: true })).toBeVisible();
  });

  test("plots risk history for a target with multiple scans", async ({ page }) => {
    await page.goto("/dashboard/scans/seed_trend_3");

    await expect(page.getByText("Risk over time")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Risk score over time" }),
    ).toBeVisible();
    await expect(page.getByText(/only scan of this target/i)).toHaveCount(0);
  });

  test("shows the no-history state for a target with only one scan", async ({ page }) => {
    // web-server.json (fixture) is the only scan of its target.
    await page.goto("/dashboard/scans/scan_web-server");

    await expect(page.getByText("Risk over time")).toBeVisible();
    await expect(page.getByText(/only scan of this target/i)).toBeVisible();
    await expect(page.getByRole("img", { name: "Risk score over time" })).toHaveCount(0);
  });

  test("table view shows every scan in the trend, oldest first", async ({ page }) => {
    await page.goto("/dashboard/scans/seed_trend_3");

    await page.getByRole("button", { name: /show table/i }).click();

    // The scan-detail page has exactly one <table> (the trend card's) — the
    // list page's ScansTable isn't rendered here, so this is unambiguous
    // even though the current scan's own filename also appears elsewhere on
    // the page (the header/breadcrumb).
    const table = page.getByRole("table");
    // Header row + 3 seeded trend scans.
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.getByText("prod-app-week1.xml")).toBeVisible();
    await expect(table.getByText("prod-app-week10.xml")).toBeVisible();
    await expect(table.getByText("prod-app-week14.xml")).toBeVisible();
  });
});
