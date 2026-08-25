import { test, expect } from "@playwright/test";
import path from "node:path";

const FIXTURE_XML = path.resolve(__dirname, "../../fixtures/nmap/linux-host.xml");

test.describe("Upload flow", () => {
  test("uploads a scan and navigates to its dashboard", async ({ page }) => {
    await page.goto("/dashboard/upload");

    await page.getByLabel("Nmap XML scan file").setInputFiles(FIXTURE_XML);
    await page.getByRole("button", { name: /analyze scan/i }).click();

    await expect(page.getByRole("button", { name: /view scan/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /view scan/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/scans\/.+/);
    await expect(page.getByText(/risk score/i).first()).toBeVisible();
  });

  test("shows a validation error for a non-XML file", async ({ page }) => {
    await page.goto("/dashboard/upload");

    const notXml = path.resolve(__dirname, "../../fixtures/kev/sample-catalog.json");
    await page.getByLabel("Nmap XML scan file").setInputFiles(notXml);

    await expect(page.getByText(/upload a valid nmap xml file/i)).toBeVisible();
  });
});
