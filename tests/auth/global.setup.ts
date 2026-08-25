import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import path from "node:path";

// Runs once before the "chromium" project (see playwright.config.ts's
// `dependencies`). clerkSetup() fetches a Testing Token that lets automated
// browsers past Clerk's bot protection; signing in and saving storageState
// here means individual specs start already authenticated instead of each
// repeating the sign-in flow.
setup.describe.configure({ mode: "serial" });

setup("global setup", async () => {
  await clerkSetup();
});

const authFile = path.join(__dirname, "../../playwright/.clerk/user.json");

setup("authenticate and save state to storage", async ({ page }) => {
  if (!process.env.E2E_CLERK_USER_EMAIL) {
    throw new Error(
      "E2E_CLERK_USER_EMAIL is not set. Run `npx tsx scripts/resolve-e2e-user.ts` first.",
    );
  }

  // clerk.signIn requires a prior navigation to a page that loads Clerk.
  await page.goto("/");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_CLERK_USER_EMAIL,
  });

  await page.goto("/dashboard/scans");
  await page.waitForURL("**/dashboard/scans");
  await page.context().storageState({ path: authFile });
});
