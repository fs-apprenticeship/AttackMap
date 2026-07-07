"use server";

import { updateTag } from "next/cache";
import { requireAuthSync } from "@/lib/auth/sync";
import { parseNmapScan } from "@/lib/nmap/parse-nmap";
import { ScanSchema } from "@/lib/nmap/schema";
import type { Scan } from "@/lib/types";
import { deleteScan, saveScan } from "@/lib/scans/store";

function getXmlUpload(formData: FormData): File {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("No file uploaded.");
  }

  if (!file.name.toLowerCase().endsWith(".xml")) {
    throw new Error("Invalid file type. Please upload an Nmap XML file.");
  }

  return file;
}

export async function uploadScanAction(formData: FormData): Promise<Scan> {
  const userId = await requireAuthSync();
  const file = getXmlUpload(formData);
  const xml = await file.text();
  const scan = parseNmapScan(xml, file.name);

  await saveScan(scan, userId);
  updateTag(`scans:${userId}`);

  return scan;
}

export async function saveScanAction(scan: Scan): Promise<void> {
  const userId = await requireAuthSync();
  const validated = ScanSchema.parse(scan);
  await saveScan(validated, userId);
  updateTag(`scans:${userId}`);
}

export async function deleteScanAction(id: string): Promise<void> {
  const userId = await requireAuthSync();
  await deleteScan(id, userId);
  updateTag(`scans:${userId}`);
}
