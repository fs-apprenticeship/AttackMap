"use server";

import { requireAuthSync } from "@/lib/auth/sync";
import { parseNmapScanFromParsed } from "@/lib/nmap/parse-nmap";
import { readValidatedNmapXml } from "@/lib/nmap/upload-validation";
import { ScanSchema } from "@/lib/nmap/schema";
import type { Scan } from "@/lib/types";
import { deleteScan, saveScanChunked } from "@/lib/scans/store";
import { invalidateScansCache } from "@/lib/scans/cache";
import { dismissImportJob } from "@/lib/scans/import-jobs";

export async function uploadScanAction(formData: FormData): Promise<Scan> {
  const userId = await requireAuthSync();
  const file = formData.get("file");

  const validated = await readValidatedNmapXml(file instanceof File ? file : undefined);
  if (!validated.ok) {
    throw new Error(validated.issue.message);
  }

  const scan = parseNmapScanFromParsed(validated.raw, (file as File).name);

  await saveScanChunked(scan, userId);
  invalidateScansCache(userId);

  return scan;
}

export async function saveScanAction(scan: Scan): Promise<void> {
  const userId = await requireAuthSync();
  const validated = ScanSchema.parse(scan);
  await saveScanChunked(validated, userId);
  invalidateScansCache(userId);
}

export async function deleteScanAction(id: string): Promise<void> {
  const userId = await requireAuthSync();
  await deleteScan(id, userId);
  invalidateScansCache(userId);
}

export async function dismissImportJobAction(jobId: string): Promise<void> {
  const userId = await requireAuthSync();
  await dismissImportJob(jobId, userId);
  invalidateScansCache(userId);
}
