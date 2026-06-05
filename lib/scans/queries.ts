import "server-only";
import { cacheTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { listScans, getScan } from "@/lib/scans/store";
import type { Scan } from "@/lib/parser/schema";

async function fetchScansForUser(userId: string): Promise<Scan[]> {
  "use cache";
  cacheTag(`scans:${userId}`);
  return listScans(userId);
}

async function fetchScanForUser(id: string, userId: string): Promise<Scan | undefined> {
  "use cache";
  cacheTag(`scans:${userId}`);
  return getScan(id, userId);
}

export async function listScansCached(): Promise<Scan[]> {
  const { userId } = await auth();
  if (!userId) return [];
  return fetchScansForUser(userId);
}

export async function getScanCached(id: string): Promise<Scan | undefined> {
  const { userId } = await auth();
  if (!userId) return undefined;
  return fetchScanForUser(id, userId);
}
