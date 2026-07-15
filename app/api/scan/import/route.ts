import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";

import { getOptionalAuth } from "@/lib/auth/sync";
import {
  countUploadChunks,
  createScanImportJob,
  getScanImportJob,
  processScanImportJob,
} from "@/lib/scans/import-jobs";
import { MAX_LARGE_SCAN_UPLOAD_BYTES } from "@/lib/nmap/upload-validation-config";

// Bounds how long the background parse+save can run inside the same
// invocation that creates the job (see after() below). The reconciliation
// cron (app/api/cron/reconcile-scan-imports/route.ts) is the safety net for
// anything that doesn't finish within this window.
export const maxDuration = 300;

// Finalizes an upload that's already been split into chunks and POSTed to
// /api/scan/import/chunk (see features/upload/upload-card.tsx) — this route
// never receives the file body itself, just small JSON.
const ImportRequestSchema = z.object({
  uploadId: z.string().min(1),
  filename: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const userId = await getOptionalAuth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to upload scans." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid uploadId, filename, fileSizeBytes, or totalChunks." },
      { status: 400 },
    );
  }

  const { uploadId, filename, fileSizeBytes, totalChunks } = parsed.data;
  if (fileSizeBytes > MAX_LARGE_SCAN_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the large-scan upload limit." },
      { status: 413 },
    );
  }

  const uploadedChunks = await countUploadChunks(uploadId, userId);
  if (uploadedChunks !== totalChunks) {
    return NextResponse.json(
      { error: `Upload incomplete: received ${uploadedChunks} of ${totalChunks} chunks.` },
      { status: 409 },
    );
  }

  const job = await createScanImportJob({ userId, filename, fileSizeBytes, uploadId });

  // Runs after the response is sent, in the same invocation — no dependency
  // on a queue or external worker for the common case. The reconciliation
  // cron catches it if this invocation is killed before finishing.
  after(() =>
    processScanImportJob(job.id).catch((error) => {
      console.error(`Scan import job ${job.id} failed:`, error);
    }),
  );

  return NextResponse.json({ job }, { status: 202 });
}

export async function GET(request: NextRequest) {
  const userId = await getOptionalAuth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to view import jobs." }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const job = await getScanImportJob(jobId, userId);
  if (!job) {
    return NextResponse.json({ error: "Import job not found." }, { status: 404 });
  }

  return NextResponse.json({ job }, { status: 200 });
}
