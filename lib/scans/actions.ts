"use server";

import { revalidatePath } from "next/cache";

import { ScanSchema } from "@/lib/parser/schema";
import type { Scan } from "@/lib/types";
import { deleteScan, saveScan } from "@/lib/scans/store";

// Server Actions are the client's only entry point for mutating scans. They wrap
// the server-only store (which talks to the DB) and revalidate the affected
// routes so server-rendered pages reflect the change. Auth checks (Clerk userId)
// will be added here when auth lands — this is the single choke point for it.

/** Persist a scan (insert or overwrite, incl. merged AI output). */
export async function saveScanAction(scan: Scan): Promise<void> {
  const validated = ScanSchema.parse(scan);
  await saveScan(validated);
  revalidatePath("/");
  revalidatePath("/scans");
  revalidatePath(`/scans/${validated.id}`);
}

/** Remove a scan. */
export async function deleteScanAction(id: string): Promise<void> {
  await deleteScan(id);
  revalidatePath("/");
  revalidatePath("/scans");
}
