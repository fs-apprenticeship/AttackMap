import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

// A CI build that has org/project configured but no auth token would silently
// ship without source maps — unreadable production stack traces defeat a core
// Sentry acceptance criterion, so fail loudly instead. Local builds without
// any of these env vars are untouched and never attempt an upload.
if (process.env.CI && (process.env.SENTRY_ORG || process.env.SENTRY_PROJECT) && !process.env.SENTRY_AUTH_TOKEN) {
  throw new Error(
    "SENTRY_ORG/SENTRY_PROJECT are set but SENTRY_AUTH_TOKEN is missing — source maps would fail to upload. " +
      "Set SENTRY_AUTH_TOKEN or unset SENTRY_ORG/SENTRY_PROJECT for this build.",
  );
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // No tunnelRoute: phase one avoids proxying Sentry traffic through the app's
  // own domain unless ad-blocker loss is measured to be material (see
  // docs/SENTRY_IMPLEMENTATION.md, "Deferred").

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
