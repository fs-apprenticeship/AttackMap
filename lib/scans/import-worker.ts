import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { parseNmapScanFromParsed } from "@/lib/parser/parse-nmap";
import {
  parseValidatedNmapXmlText,
  type UploadValidationIssue,
} from "@/lib/parser/upload-validation";
import { saveScan } from "@/lib/scans/store";

export const ScanImportJobStatusSchema = z.enum([
  "queued",
  "validating",
  "parsing",
  "saving",
  "complete",
  "failed",
]);

export const ScanImportJobSchema = z.object({
  id: z.string(),
  userId: z.string(),
  filename: z.string(),
  status: ScanImportJobStatusSchema,
  scanId: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ScanImportJobStatus = z.infer<typeof ScanImportJobStatusSchema>;
export type ScanImportJob = z.infer<typeof ScanImportJobSchema>;

type QueuedImport = {
  job: ScanImportJob;
  xml: string;
};

const globalForImports = globalThis as typeof globalThis & {
  attackMapScanImportJobs?: Map<string, QueuedImport>;
};

const jobs =
  globalForImports.attackMapScanImportJobs ??
  new Map<string, QueuedImport>();

if (process.env.NODE_ENV !== "production") {
  globalForImports.attackMapScanImportJobs = jobs;
}

type CreateScanImportJobInput = {
  userId: string;
  filename: string;
  xml: string;
  autoStart?: boolean;
};

export function createScanImportJob({
  userId,
  filename,
  xml,
  autoStart = true,
}: CreateScanImportJobInput): ScanImportJob {
  const now = new Date().toISOString();
  const job: ScanImportJob = {
    id: `scan_import_${randomUUID()}`,
    userId,
    filename,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(job.id, { job, xml });

  if (autoStart) {
    queueMicrotask(() => {
      void processScanImportJob(job.id);
    });
  }

  return ScanImportJobSchema.parse(job);
}

export function getScanImportJob(
  id: string,
  userId: string,
): ScanImportJob | undefined {
  const entry = jobs.get(id);
  if (!entry || entry.job.userId !== userId) return undefined;
  return ScanImportJobSchema.parse(entry.job);
}

export async function processScanImportJob(
  id: string,
): Promise<ScanImportJob | undefined> {
  const entry = jobs.get(id);
  if (!entry) return undefined;

  setJobStatus(entry, "validating");
  const validation = parseValidatedNmapXmlText(entry.xml);
  if (!validation.ok) {
    failJob(entry, validation.issue);
    return ScanImportJobSchema.parse(entry.job);
  }

  try {
    setJobStatus(entry, "parsing");
    const scan = parseNmapScanFromParsed(validation.raw, entry.job.filename);

    setJobStatus(entry, "saving");
    await saveScan(scan, entry.job.userId);

    entry.xml = "";
    updateJob(entry, {
      status: "complete",
      scanId: scan.id,
      errorCode: undefined,
      errorMessage: undefined,
    });
  } catch (error) {
    failJob(entry, {
      code: "import_failed",
      message:
        error instanceof Error ? error.message : "Failed to import scan.",
    });
  }

  return ScanImportJobSchema.parse(entry.job);
}

export function clearScanImportJobsForTests() {
  if (process.env.NODE_ENV === "production") return;
  jobs.clear();
}

function setJobStatus(entry: QueuedImport, status: ScanImportJobStatus) {
  updateJob(entry, { status });
}

function updateJob(
  entry: QueuedImport,
  patch: Partial<Omit<ScanImportJob, "id" | "userId" | "filename" | "createdAt">>,
) {
  entry.job = ScanImportJobSchema.parse({
    ...entry.job,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  jobs.set(entry.job.id, entry);
}

function failJob(
  entry: QueuedImport,
  issue: Pick<UploadValidationIssue, "code" | "message">,
) {
  entry.xml = "";
  updateJob(entry, {
    status: "failed",
    errorCode: issue.code,
    errorMessage: issue.message,
  });
}
