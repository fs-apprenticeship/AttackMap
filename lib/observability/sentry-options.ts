// Shared, runtime-safe Sentry configuration primitives. This module is
// imported from the browser, Node, and Edge init files, so it must only
// contain primitive values and pure functions — no Node-only APIs, no
// database/Prisma imports, nothing that would break the client bundle.


import type { Breadcrumb, Event } from "@sentry/nextjs";

// `@sentry/nextjs` only re-exports a curated subset of `@sentry/core`'s
// types — `TransactionEvent` and `TracesSamplerSamplingContext` aren't in it.
// `Event` is the common base of both `ErrorEvent` and `TransactionEvent`, and
// covers every field this module touches, so callers can pass either.
type TracesSamplerSamplingContext = { name?: string };

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const SENTRY_ENVIRONMENT: string =
  process.env.SENTRY_ENVIRONMENT ??
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.VERCEL_ENV ??
  (process.env.NODE_ENV === "production" ? "production" : "development");

/** Kill switch: event delivery defaults on in preview/production, off locally. */
export function isSentryEnabled(): boolean {
  const flag = process.env.SENTRY_ENABLED;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return SENTRY_ENVIRONMENT !== "development";
}

// --- Tracing sampling ----------------------------------------------------


const BASE_TRACES_SAMPLE_RATE: Record<string, number> = {
  development: 0,
  preview: 0.1,
  production: 0.05,
};

// Low-volume, high-value flows keep a higher trace rate so they aren't
// drowned out by high-volume polling/status requests on the same routes.
const PRIORITY_TRACE_ROUTES = [
  "/api/scan/import",
  "/api/cron/reconcile-scan-imports",
];
const PRIORITY_TRACE_SAMPLE_RATE = 0.5;

export function sentryTracesSampler(
  samplingContext: TracesSamplerSamplingContext,
): number {
  const base = BASE_TRACES_SAMPLE_RATE[SENTRY_ENVIRONMENT] ?? 0;
  // Tracing stays fully off in local development regardless of route — the
  // priority boost only widens preview/production sampling, it never turns
  // tracing on where it was deliberately disabled.
  if (base === 0) return 0;
  const name = samplingContext.name ?? "";
  const isPriority = PRIORITY_TRACE_ROUTES.some((route) => name.includes(route));
  return isPriority ? Math.max(base, PRIORITY_TRACE_SAMPLE_RATE) : base;
}

// --- Sensitive-data scrubbing ---------------------------------------------
// Defense in depth alongside `sendDefaultPii: false` and server-side Sentry
// scrubbing rules. Allowlist-shaped: strip everything from `request` except
// the path, then redact known-sensitive headers if any remain.

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-clerk-auth-token",
  "x-clerk-auth-signature",
]);

function redactHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? "[Filtered]" : value;
  }
  return redacted;
}

/** Strips query string, hash, and userinfo; keeps only origin + path. */
function stripToPath(url?: string): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

function scrubRequest(
  request: Event["request"],
): Event["request"] {
  if (!request) return request;
  return {
    url: stripToPath(request.url),
    method: request.method,
    headers: redactHeaders(request.headers),
    // Never forward query strings, cookies, request bodies, or raw env.
    query_string: undefined,
    cookies: undefined,
    data: undefined,
    env: undefined,
  };
}

/**
 * Applied via `beforeSend`/`beforeSendTransaction` in all three runtime
 * configs. Removes hostnames/IPs, request bodies, cookies, auth headers, and
 * anything beyond the opaque Clerk user id.
 */
export function scrubSentryEvent<E extends Event>(event: E): E {
  const scrubbed: E = { ...event };
  scrubbed.request = scrubRequest(event.request);
  scrubbed.server_name = undefined;
  if (scrubbed.user) {
    scrubbed.user = scrubbed.user.id ? { id: scrubbed.user.id } : undefined;
  }
  // Phase one carries no ad hoc "extra" payloads — allowlisted tags/contexts
  // are the only supported metadata channel (see docs, "Prefer allowlisting").
  scrubbed.extra = undefined;
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  return scrubbed;
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console capture is deferred (see docs) — drop any console breadcrumbs
  // that slip in from a dependency's own instrumentation.
  if (breadcrumb.category === "console") return null;
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  if (typeof data.url === "string") data.url = stripToPath(data.url);
  delete data.body;
  delete data.request_body_size;
  delete data.response_body_size;
  return { ...breadcrumb, data };
}
