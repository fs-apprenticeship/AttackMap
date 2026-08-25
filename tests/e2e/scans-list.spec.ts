import { test, expect } from "@playwright/test";

// Exercises the seeded data from prisma/seed.ts — run `npm run db:seed`
// (after `npx tsx scripts/resolve-e2e-user.ts`) before this spec.

test.describe("Scans list", () => {
  test("shows the seeded scans with a New scan action", async ({ page }) => {
    await page.goto("/dashboard/scans");

    await expect(page.getByRole("heading", { name: "Scans" })).toBeVisible();
    // Scoped to main: the persistent sidebar nav has its own "New scan" link.
    await expect(page.getByRole("main").getByRole("link", { name: /new scan/i })).toBeVisible();

    // One of the static fixtures (see prisma/seed.ts's FIXTURE_NAMES).
    await expect(page.getByRole("table").getByText("helix.htb")).toBeVisible();
  });

  test("navigates to a scan's detail page", async ({ page }) => {
    await page.goto("/dashboard/scans");

    // Scoped to the desktop table: the mobile card variant (hidden at this
    // viewport but still in the DOM) renders the same link and would
    // otherwise make this locator ambiguous. The filename is the clickable
    // cell; target is a plain (non-link) cell.
    await page.getByRole("table").getByRole("link", { name: "simple-web-server.xml" }).click();

    await expect(page).toHaveURL(/\/dashboard\/scans\/.+/);
    await expect(page.getByText(/risk score/i).first()).toBeVisible();
  });
});
