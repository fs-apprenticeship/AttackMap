import { NextRequest, NextResponse } from "next/server";

import { getOptionalAuth } from "@/lib/auth/sync";
import {
  createScanImportJob,
  getScanImportJob,
} from "@/lib/scans/import-worker";
import {
  statusForUploadValidationIssue,
  validateUploadedScanFile,
} from "@/lib/nmap/upload-validation";

export async function POST(request: NextRequest) {
  const userId = await getOptionalAuth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to upload scans." },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const fileValidation = validateUploadedScanFile(
    file instanceof File ? file : undefined,
  );

  if (!fileValidation.ok) {
    return NextResponse.json(
      {
        error: fileValidation.issue.message,
        code: fileValidation.issue.code,
      },
      { status: statusForUploadValidationIssue(fileValidation.issue) },
    );
  }

  const validFile = file as File;
  const job = createScanImportJob({
    userId,
    filename: validFile.name,
    xml: await validFile.text(),
  });

  return NextResponse.json({ job }, { status: 202 });
}

export async function GET(request: NextRequest) {
  const userId = await getOptionalAuth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to view import jobs." },
      { status: 401 },
    );
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const job = getScanImportJob(jobId, userId);
  if (!job) {
    return NextResponse.json({ error: "Import job not found." }, { status: 404 });
  }

  return NextResponse.json({ job }, { status: 200 });
}
