import { db } from "@/lib/db";
import { ScanSchema } from "@/lib/parser/schema";
import type { Scan } from "@/lib/parser/schema";


// subscribeScans / getScansSnapshot / getServerScansSnapshot are removed —
// those existed to feed useSyncExternalStore, which requires synchronous
// snapshots. Async DB calls are incompatible with that pattern; hooks that
// consumed those exports should be migrated to useEffect + useState.

/** All scans ordered newest first. Rows that fail schema validation are dropped. */
export async function listScans(): Promise<Scan[]> {
  const rows = await db.scan.findMany({
    orderBy: { createdAt: "desc" },
  });

  return rows.flatMap((row) => {
    const result = ScanSchema.safeParse(row.data);
    return result.success ? [result.data] : [];
  });
}

/** Single scan by id. Returns undefined if not found or invalid. */
export async function getScan(id: string): Promise<Scan | undefined> {
  const row = await db.scan.findUnique({ where: { id } });
  if (!row) return undefined;

  const result = ScanSchema.safeParse(row.data);
  return result.success ? result.data : undefined;
}

/** Upsert by id — inserts on first save, overwrites on subsequent saves
 *  (including after AI fields are merged in). */
export async function saveScan(scan: Scan): Promise<void> {
  const row = {
    target: scan.target,
    filename: scan.filename,
    scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : null,
    parsedAt: new Date(scan.parsedAt),
    data: scan,
  };

  await db.scan.upsert({
    where: { id: scan.id },
    update: row,
    create: { id: scan.id, ...row },
  });
}

/** Delete a scan. Silent no-op if the id does not exist. */
export async function deleteScan(id: string): Promise<void> {
  await db.scan.deleteMany({ where: { id } });
}
