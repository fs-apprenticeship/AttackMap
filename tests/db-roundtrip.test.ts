// Integration test: scan store round-trip against a real Postgres.
//
// Exercises the normalized schema end to end — saveScan() decomposes a Scan
// into scan/host/service/finding rows, getScan() recomposes them back into the
// Zod Scan shape. This is the highest-value check on the AUTH-and-DB migration:
// it catches silent mapping drift (dropped fields, null vs undefined, enum
// mismatches) that the JSON-blob store could never have.
//
// This is an OPT-IN integration test: it only runs when RUN_DB_TESTS=1 AND a
// DATABASE_URL is set. The normal `npm test` run always skips it — even in CI
// where DATABASE_URL may be present — so it never mutates a database by
// surprise. Run it deliberately with `npm run test:db` (which sets the flag and
// loads .env), after `npx prisma migrate deploy` against a throwaway DB.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ScanSchema, type Scan, type RemediationPlan } from "@/lib/nmap/schema";

const FIXTURES = [
  "simple-web-server",
  "web-server",
  "linux-host",
  "domain-controller",
  "internal-platform",
  "scanme-public-host",
] as const;

function loadFixture(name: string): Scan {
  const raw = readFileSync(
    path.resolve(__dirname, `../fixtures/scans/${name}.json`),
    "utf8",
  );
  // Parse through the same Zod schema the app uses, so defaults (e.g. topRisks)
  // are applied exactly as they would be at runtime.
  return ScanSchema.parse(JSON.parse(raw));
}

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

// DB row order is not guaranteed; normalize to compare by content, not order.
function normalizeStructural(scan: Scan) {
  return {
    id: scan.id,
    filename: scan.filename,
    target: scan.target,
    uploadedAt: scan.uploadedAt,
    parsedAt: scan.parsedAt,
    scannedAt: scan.scannedAt,
    hosts: [...scan.hosts].sort(byId).map((h) => ({
      ...h,
      services: [...h.services].sort(byId),
    })),
    // `host` (the display label) has no column on Finding and is intentionally
    // not persisted — compare only the fields the schema actually stores.
    findings: [...scan.findings].sort(byId).map((f) => ({
      id: f.id,
      hostId: f.hostId,
      severity: f.severity,
      title: f.title,
      evidence: f.evidence,
      remediation: f.remediation,
    })),
  };
}

// Explicit opt-in: requires BOTH the flag and a connection string, so it never
// runs from a bare `npm test` (even if CI has DATABASE_URL set). `npm run
// test:db` sets RUN_DB_TESTS=1 and loads .env.
const runDbTests =
  process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runDbTests)(
  "scan store round-trip (integration — run via `npm run test:db`)",
  () => {
    // Imported dynamically so the Prisma client is never instantiated when the
    // suite is skipped.
    let store: typeof import("@/lib/scans/store");

    beforeAll(async () => {
      store = await import("@/lib/scans/store");
    });

    afterAll(async () => {
      if (!store) return;
      for (const name of FIXTURES) {
        await store.deleteScan(loadFixture(name).id);
      }
    });

    it.each(FIXTURES)(
      "preserves scan/host/service/finding data for %s",
      async (name) => {
        const scan = loadFixture(name);
        await store.saveScan(scan);
        const reloaded = await store.getScan(scan.id);

        expect(reloaded).toBeDefined();
        expect(normalizeStructural(reloaded!)).toEqual(
          normalizeStructural(scan),
        );
      },
    );

    it.each(FIXTURES)(
      "derives the rule-based summary + remediation on read for %s (not blank, not stored)",
      async (name) => {
        const scan = loadFixture(name);
        await store.saveScan(scan);
        const reloaded = await store.getScan(scan.id);

        expect(reloaded).toBeDefined();
        // The rule-based summary/remediation are recomputed from the stored
        // hosts/findings, so they match the parser's output exactly — and are
        // never blank.
        expect(reloaded!.summary).toEqual(scan.summary);
        expect(reloaded!.summary.executive).not.toBe("");
        expect(reloaded!.summary.source).toBe("rule-based");

        // Steps are derived from findings, whose DB row order isn't guaranteed,
        // so compare the plan order-insensitively (same content, any order).
        const sortSteps = (p: RemediationPlan) => ({
          source: p.source,
          steps: [...p.steps].sort((a, b) => a.title.localeCompare(b.title)),
        });
        expect(sortSteps(reloaded!.remediationPlan)).toEqual(
          sortSteps(scan.remediationPlan),
        );

        // A plain upload must NOT write an AiSummary row — that table is for AI
        // output only.
        const { db } = await import("@/lib/db");
        const aiRow = await db.aiSummary.findUnique({
          where: { scanId: scan.id },
        });
        expect(aiRow).toBeNull();
      },
    );

    it("scopes reads by userId and isolates between users", async () => {
      // scans.user_id has a FK to users.id, so the owner row must exist first.
      const { db } = await import("@/lib/db");
      await db.user.upsert({
        where: { id: "user_a" },
        update: {},
        create: { id: "user_a", email: "a@test.local" },
      });
      await db.user.upsert({
        where: { id: "user_b" },
        update: {},
        create: { id: "user_b", email: "b@test.local" },
      });

      const scan = loadFixture("simple-web-server");
      await store.saveScan(scan, "user_a");

      // Owner sees it; a different user does not.
      expect(await store.getScan(scan.id, "user_a")).toBeDefined();
      expect(await store.getScan(scan.id, "user_b")).toBeUndefined();

      const userAScans = await store.listScans("user_a");
      expect(userAScans.some((s) => s.id === scan.id)).toBe(true);
      const userBScans = await store.listScans("user_b");
      expect(userBScans.some((s) => s.id === scan.id)).toBe(false);

      // user_b must not be able to overwrite / hijack user_a's scan.
      await expect(store.saveScan(scan, "user_b")).rejects.toThrow();
      // ...and user_a still owns it, untouched.
      expect((await store.getScan(scan.id, "user_a"))?.id).toBe(scan.id);

      // cleanup (delete scan before users to respect the FK)
      await store.deleteScan(scan.id, "user_a");
      await db.user.deleteMany({ where: { id: { in: ["user_a", "user_b"] } } });
    });
  },
);
