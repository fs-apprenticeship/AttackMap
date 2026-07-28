import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Opaque Clerk id only — no email, name, or session data. Set on the
 * isolation scope (not the global scope) so concurrent server requests never
 * see each other's user context. See docs/SENTRY_IMPLEMENTATION.md, "Add
 * identity context safely".
 */
export function setSentryRequestUser(userId: string): void {
  Sentry.getIsolationScope().setUser({ id: userId });
}
