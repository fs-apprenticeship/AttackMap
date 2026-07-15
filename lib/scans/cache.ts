import "server-only";
import { revalidateTag } from "next/cache";

export function invalidateScansCache(userId: string): void {
  revalidateTag(`scans:${userId}`, { expire: 0 });
}
