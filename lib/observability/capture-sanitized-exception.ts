import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Use for failures that can carry uploaded scan content, AI prompts/responses,
 * or other request-derived data in their `message` — nmap parsing/validation
 * errors and upstream AI/API errors can echo input back in their message.
 * docs/SENTRY_IMPLEMENTATION.md prohibits that data in exception messages, so
 * this keeps the original stack trace and error name (for grouping and
 * debugging) but replaces the message with a fixed, safe description and
 * attaches only allowlisted tags — never the original message.
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
