"use server";

import { revalidateTag } from "next/cache";
import { requireAuthSync } from "@/lib/auth/sync";
import { ScanSchema } from "@/lib/parser/schema";
import type { Scan } from "@/lib/types";
import { deleteScan, saveScan } from "@/lib/scans/store";

export async function saveScanAction(scan: Scan): Promise<void> {
  const userId = await requireAuthSync();
  const validated = ScanSchema.parse(scan);
  await saveScan(validated, userId);
  revalidateTag(`scans:${userId}`);
}

export async function deleteScanAction(id: string): Promise<void> {
  const userId = await requireAuthSync();
  await deleteScan(id, userId);
  revalidateTag(`scans:${userId}`);
}
