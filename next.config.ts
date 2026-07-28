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

if (process.env.CI && (process.env.SENTRY_ORG || process.env.SENTRY_PROJECT) && !process.env.SENTRY_AUTH_TOKEN) {
  throw new Error(
    "SENTRY_ORG/SENTRY_PROJECT are set but SENTRY_AUTH_TOKEN is missing — source maps would fail to upload. " +
      "Set SENTRY_AUTH_TOKEN or unset SENTRY_ORG/SENTRY_PROJECT for this build.",
  );
}

export default withSentryConfig(nextConfig, {

  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

 
  silent: !process.env.CI,

  
  widenClientFileUpload: true,

  
  webpack: {
   
    automaticVercelMonitors: true,

    
    treeshake: {
     
      removeDebugLogging: true,
    },
  },
});
