import "server-only";
import { revalidateTag } from "next/cache";

// Single invalidation entry point for every scan write path (sync upload,
// server action save/delete, async large-scan import) so a write can never
// forget to invalidate the cache tag `listScansCached`/`getScanCached` read
// from (lib/scans/queries.ts). Standardized on revalidateTag rather than
// updateTag because updateTag only works inside Server Actions, while this
// also needs to run from Route Handlers and from background job code
// invoked via `after()` (lib/scans/import-jobs.ts), where updateTag throws.
export function invalidateScansCache(userId: string): void {
  revalidateTag(`scans:${userId}`, { expire: 0 });
}
