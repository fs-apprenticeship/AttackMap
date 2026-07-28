import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// isSentryEnabled()/sentryTracesSampler() close over module-load-time env
// reads, so each scenario stubs env vars, resets the module registry, and
// re-imports fresh — this exercises the same top-level evaluation that
// happens once per real process.
async function loadModule() {
  vi.resetModules();
  return import("./sentry-options");
}

describe("isSentryEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to disabled when environment resolves to development", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "development");
    vi.stubEnv("SENTRY_ENABLED", "");
    const { isSentryEnabled } = await loadModule();
    expect(isSentryEnabled()).toBe(false);
  });

  it("defaults to enabled in preview", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "preview");
    vi.stubEnv("SENTRY_ENABLED", "");
    const { isSentryEnabled } = await loadModule();
    expect(isSentryEnabled()).toBe(true);
  });

  it("defaults to enabled in production", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "production");
    vi.stubEnv("SENTRY_ENABLED", "");
    const { isSentryEnabled } = await loadModule();
    expect(isSentryEnabled()).toBe(true);
  });

  it("SENTRY_ENABLED=false overrides an enabled environment", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "production");
    vi.stubEnv("SENTRY_ENABLED", "false");
    const { isSentryEnabled } = await loadModule();
    expect(isSentryEnabled()).toBe(false);
  });

  it("SENTRY_ENABLED=true overrides a disabled (development) environment", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "development");
    vi.stubEnv("SENTRY_ENABLED", "true");
    const { isSentryEnabled } = await loadModule();
    expect(isSentryEnabled()).toBe(true);
  });
});

describe("sentryTracesSampler", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays at 0 in development even for a priority route", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "development");
    const { sentryTracesSampler } = await loadModule();
    expect(sentryTracesSampler({ name: "POST /api/scan/import" })).toBe(0);
  });

  it("uses the production base rate for an ordinary route", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "production");
    const { sentryTracesSampler } = await loadModule();
    expect(sentryTracesSampler({ name: "GET /api/scans" })).toBe(0.05);
  });

  it("boosts the sample rate for a priority route in production", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "production");
    const { sentryTracesSampler } = await loadModule();
    expect(sentryTracesSampler({ name: "POST /api/scan/import" })).toBe(0.5);
    expect(
      sentryTracesSampler({ name: "GET /api/cron/reconcile-scan-imports" }),
    ).toBe(0.5);
  });

  it("boosts the sample rate for a priority route in preview", async () => {
    vi.stubEnv("SENTRY_ENVIRONMENT", "preview");
    const { sentryTracesSampler } = await loadModule();
    expect(sentryTracesSampler({ name: "POST /api/scan/import" })).toBe(0.5);
  });
});

describe("scrubSentryEvent", () => {
  let scrubSentryEvent: (typeof import("./sentry-options"))["scrubSentryEvent"];

  beforeEach(async () => {
    ({ scrubSentryEvent } = await loadModule());
  });

  function baseEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
    return {
      request: {
        url: "https://attackmap.example.com/api/scan/import?token=secret&x=1",
        method: "POST",
        query_string: "token=secret&x=1",
        cookies: { session: "abc123" },
        data: { file: "<nmaprun>...</nmaprun>" },
        env: { SECRET_KEY: "shh" },
        headers: {
          authorization: "Bearer abc",
          cookie: "session=abc123",
          "user-agent": "vitest",
        },
      },
      server_name: "ip-10-0-0-1.ec2.internal",
      user: { id: "user_123", email: "person@example.com", ip_address: "1.2.3.4" },
      extra: { scanXml: "<nmaprun>...</nmaprun>" },
      ...overrides,
    } as ErrorEvent;
  }

  it("strips query strings, cookies, request bodies, and env from request", () => {
    const scrubbed = scrubSentryEvent(baseEvent());
    expect(scrubbed.request?.url).toBe("https://attackmap.example.com/api/scan/import");
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.env).toBeUndefined();
  });

  it("redacts sensitive headers but keeps safe ones", () => {
    const scrubbed = scrubSentryEvent(baseEvent());
    expect(scrubbed.request?.headers?.authorization).toBe("[Filtered]");
    expect(scrubbed.request?.headers?.cookie).toBe("[Filtered]");
    expect(scrubbed.request?.headers?.["user-agent"]).toBe("vitest");
  });

  it("drops the hostname and reduces user to the opaque id only", () => {
    const scrubbed = scrubSentryEvent(baseEvent());
    expect(scrubbed.server_name).toBeUndefined();
    expect(scrubbed.user).toEqual({ id: "user_123" });
  });

  it("drops any ad hoc extra payload", () => {
    const scrubbed = scrubSentryEvent(baseEvent());
    expect(scrubbed.extra).toBeUndefined();
  });

  it("drops console breadcrumbs and strips query strings from breadcrumb data", () => {
    const breadcrumbs: Breadcrumb[] = [
      { category: "console", message: "some log" },
      {
        category: "fetch",
        data: { url: "https://api.example.com/x?apiKey=secret", body: "raw body" },
      },
    ];
    const scrubbed = scrubSentryEvent(baseEvent({ breadcrumbs }));
    expect(scrubbed.breadcrumbs).toHaveLength(1);
    expect(scrubbed.breadcrumbs?.[0].category).toBe("fetch");
    expect(scrubbed.breadcrumbs?.[0].data?.url).toBe("https://api.example.com/x");
    expect(scrubbed.breadcrumbs?.[0].data?.body).toBeUndefined();
  });

  it("leaves user unset when there is no id", () => {
    const scrubbed = scrubSentryEvent(baseEvent({ user: { email: "person@example.com" } }));
    expect(scrubbed.user).toBeUndefined();
  });
});
