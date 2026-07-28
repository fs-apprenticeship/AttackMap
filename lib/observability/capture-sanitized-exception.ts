import "server-only";
import * as Sentry from "@sentry/nextjs";


export function captureSanitizedException(
  error: unknown,
  safeMessage: string,
  tags?: Record<string, string>,
): void {
  const original = error instanceof Error ? error : undefined;
  const safeError = new Error(safeMessage);
  if (original?.name) safeError.name = original.name;
  if (original?.stack) safeError.stack = original.stack;
  Sentry.captureException(safeError, tags ? { tags } : undefined);
}
