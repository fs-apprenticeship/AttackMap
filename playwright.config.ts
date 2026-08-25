import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // A single `next dev` (Turbopack) instance backs every test; on-demand
  // route compilation under full parallelism caused intermittent navigation
  // timeouts that don't reproduce running specs individually. Serial keeps
  // this small suite reliable locally — revisit if/when CI runs against a
  // production build instead.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testDir: "./tests/auth",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Authenticated by default (see tests/auth/global.setup.ts); specs
        // that need to test signed-out behavior override this with
        // `test.use({ storageState: { cookies: [], origins: [] } })`.
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
