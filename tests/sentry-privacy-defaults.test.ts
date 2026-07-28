import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static assertions (not a runtime Sentry.init(), which would require a real
// DSN and has network side effects) that phase-one's privacy posture is wired
// into every runtime's init file — see docs/SENTRY_IMPLEMENTATION.md.
const INIT_FILES = [
  "instrumentation-client.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
];

const root = path.resolve(__dirname, "..");

describe("Sentry init files keep phase-one privacy defaults", () => {
  for (const file of INIT_FILES) {
    const source = readFileSync(path.join(root, file), "utf-8");

    it(`${file} disables sendDefaultPii`, () => {
      expect(source).toMatch(/sendDefaultPii:\s*false/);
    });

    it(`${file} does not enable Session Replay`, () => {
      expect(source).not.toMatch(/replayIntegration/);
    });

    it(`${file} does not enable console/log capture`, () => {
      expect(source).not.toMatch(/consoleLoggingIntegration|captureConsoleIntegration|enableLogs/);
    });

    it(`${file} does not configure a tunnel route`, () => {
      expect(source).not.toMatch(/tunnelRoute/);
    });
  }
});
