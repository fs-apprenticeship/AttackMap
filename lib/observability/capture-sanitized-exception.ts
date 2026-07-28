import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Use for failures that can carry uploaded scan content, AI prompts/responses,
 * or other request-derived data in their `message` — nmap parsing/validation
 * errors and upstream AI/API errors can echo input back in their message.
 */
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
