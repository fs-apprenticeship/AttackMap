import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { parseNmapScanFromParsed } from "@/lib/nmap/parse-nmap";
import {
  readValidatedNmapXml,
  statusForUploadValidationIssue,
} from "@/lib/nmap/upload-validation";
import { saveScan } from "@/lib/scans/store";
import { getOptionalAuth } from "@/lib/auth/sync";

export async function POST(request: NextRequest) {
  const userId = await getOptionalAuth();
  if (!userId)
    return NextResponse.json({ error: "Sign in to upload scans." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File))
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  try {
    const validated = await readValidatedNmapXml(file);
    if (!validated.ok) {
      return NextResponse.json(
        {
          error: validated.issue.message,
          code: validated.issue.code,
        },
        { status: statusForUploadValidationIssue(validated.issue) },
      );
    }

    const scan = parseNmapScanFromParsed(validated.raw, file.name);
    await saveScan(scan, userId);
    revalidateTag(`scans:${userId}`, { expire: 0 });
    return NextResponse.json(scan, { status: 201 });
  } catch (error) {
    console.error("Error parsing Nmap scan:", error);
    return NextResponse.json({ error: "Failed to parse Nmap scan" }, { status: 500 });
  }
}
