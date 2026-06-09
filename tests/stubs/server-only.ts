// Test stub for the `server-only` package.
//
// `server-only` throws when imported outside a React Server Component context,
// which makes server modules (lib/db, lib/scans/store) unimportable from
// vitest. vitest.config.ts aliases `server-only` to this no-op so those modules
// can be exercised in integration tests.
export {};
