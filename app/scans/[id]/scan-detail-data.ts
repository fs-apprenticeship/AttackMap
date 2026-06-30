import "server-only";

import { getScanCached } from "@/lib/scans/queries";

export async function getScanFromParams(params: Promise<{ id: string }>) {
  const { id } = await params;
  return getScanCached(id);
}
