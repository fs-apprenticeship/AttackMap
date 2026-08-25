import { test, expect } from "@playwright/test";

test.describe("Landing page — authenticated", () => {
  test("shows the signed-in CTAs and links to the scans list", async ({ page }) => {
    await page.goto("/");

    // "View scans" appears twice (hero + bottom CTA) — both are equivalent.
    await expect(page.getByRole("link", { name: /view scans/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /get started/i })).toHaveCount(0);
  });
});

test.describe("Landing page — signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows the signed-out CTA, not the signed-in one", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /get started/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /view scans/i })).toHaveCount(0);
  });

  test("redirects a protected route back to the landing page", async ({ page }) => {
    await page.goto("/dashboard/scans");

    await expect(page).toHaveURL("/");
  });
});
