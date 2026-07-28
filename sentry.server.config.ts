// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  isSentryEnabled,
  scrubSentryEvent,
  sentryTracesSampler,
} from "@/lib/observability/sentry-options";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  enabled: isSentryEnabled(),
  sendDefaultPii: false,

  tracesSampler: sentryTracesSampler,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
});
