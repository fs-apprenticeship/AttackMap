import "server-only";
import { cacheTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { listScans, getScan } from "@/lib/scans/store";
import { listActiveOrFailedImportJobs, type ScanImportJob } from "@/lib/scans/import-jobs";
import type { Scan } from "@/lib/nmap/schema";

async function fetchScansForUser(userId: string): Promise<Scan[]> {
  "use cache";
  cacheTag(`scans:${userId}`);
  return listScans(userId);
}

async function fetchImportJobsForUser(userId: string): Promise<ScanImportJob[]> {
  "use cache";
  cacheTag(`scans:${userId}`);
  return listActiveOrFailedImportJobs(userId);
}

export async function listImportJobsCached(): Promise<ScanImportJob[]> {
  const { userId } = await auth();
  if (!userId) return [];
  return fetchImportJobsForUser(userId);
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
