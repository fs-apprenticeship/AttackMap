import "server-only";
import * as Sentry from "@sentry/nextjs";


export function setSentryRequestUser(userId: string): void {
  Sentry.getIsolationScope().setUser({ id: userId });
}
