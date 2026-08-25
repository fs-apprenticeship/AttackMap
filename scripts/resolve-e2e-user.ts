// Resolves (or creates, as a fallback) the Clerk user e2e tests sign in as,
// and records its ID in .env.local. Run manually — never at test time —
// since it's the one step that can write to your real Clerk instance.
//
//   npx tsx scripts/resolve-e2e-user.ts
//
// tests/auth/global.setup.ts only needs E2E_CLERK_USER_EMAIL (Clerk's
// testing helper signs in by email, bypassing password/verification
// entirely). prisma/seed.ts needs E2E_CLERK_USER_ID, so seeded scans are
// attached to the same account the browser signs in as.
import { config as loadEnv } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ENV_LOCAL_PATH = path.resolve(__dirname, "../.env.local");

// Mirror Next.js's own precedence: .env first, then .env.local overriding it
// (plain `dotenv/config` only reads .env and would silently miss anything
// that's only set in .env.local).
loadEnv({ path: path.resolve(__dirname, "../.env") });
loadEnv({ path: ENV_LOCAL_PATH, override: true });
const DEFAULT_EMAIL = "e2e+clerk_test@attackmap.dev";

function readEnvLocal(): string {
  return existsSync(ENV_LOCAL_PATH) ? readFileSync(ENV_LOCAL_PATH, "utf8") : "";
}

/** Set KEY=value in .env.local, replacing an existing line for KEY or appending one. */
function upsertEnvVar(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) return contents.replace(pattern, line);
  const withNewline = contents.endsWith("\n") || contents === "" ? contents : `${contents}\n`;
  return `${withNewline}${line}\n`;
}

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not set (check .env.local).");
  }

  const email = process.env.E2E_CLERK_USER_EMAIL || DEFAULT_EMAIL;
  const client = createClerkClient({ secretKey });

  const existing = await client.users.getUserList({ emailAddress: [email] });
  let userId: string;

  if (existing.data.length > 0) {
    userId = existing.data[0].id;
    console.log(`Found existing Clerk user for ${email}: ${userId}`);
  } else {
    // Only reached for a fresh email (e.g. a new Clerk project) — the
    // password is required by the API but never used: clerk.signIn() in
    // tests/auth/global.setup.ts authenticates by email via a testing
    // token, bypassing password entirely.
    const password = randomUUID();
    const user = await client.users.createUser({ emailAddress: [email], password });
    userId = user.id;
    console.log(`Created Clerk user for ${email}: ${userId}`);
  }

  let contents = readEnvLocal();
  contents = upsertEnvVar(contents, "E2E_CLERK_USER_EMAIL", email);
  contents = upsertEnvVar(contents, "E2E_CLERK_USER_ID", userId);
  writeFileSync(ENV_LOCAL_PATH, contents);

  console.log("Wrote E2E_CLERK_USER_EMAIL / E2E_CLERK_USER_ID to .env.local");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
