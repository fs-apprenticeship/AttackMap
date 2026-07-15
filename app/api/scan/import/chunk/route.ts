import { NextRequest, NextResponse } from "next/server";

import { getOptionalAuth } from "@/lib/auth/sync";
import { saveUploadChunk } from "@/lib/scans/import-jobs";
import {
  MAX_UPLOAD_CHUNK_BYTES,
  MAX_UPLOAD_CHUNKS,
} from "@/lib/nmap/upload-validation-config";

// One piece of a large-scan upload. The client splits the file client-side
// (see features/upload/upload-card.tsx) since Vercel Functions cap request
// bodies at 4.5MB — there's no single request that could carry the whole
// file. Raw bytes as the body (not JSON/base64) to avoid ~33% encoding
// overhead eating into that margin. See docs/LARGE_SCAN_PROCESSING.md.
export async function POST(request: NextRequest) {
  const userId = await getOptionalAuth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to upload scans." }, { status: 401 });
  }

  const uploadId = request.nextUrl.searchParams.get("uploadId");
  const chunkIndexRaw = request.nextUrl.searchParams.get("chunkIndex");
  const chunkIndex = chunkIndexRaw === null ? NaN : Number(chunkIndexRaw);

  if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Missing or invalid uploadId/chunkIndex." }, { status: 400 });
  }
  if (chunkIndex >= MAX_UPLOAD_CHUNKS) {
    return NextResponse.json({ error: "Too many chunks for a single upload." }, { status: 413 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Empty chunk." }, { status: 400 });
  }
  if (bytes.length > MAX_UPLOAD_CHUNK_BYTES) {
    return NextResponse.json({ error: "Chunk exceeds the per-chunk size limit." }, { status: 413 });
  }

  await saveUploadChunk({ uploadId, userId, chunkIndex, data: bytes });

  return NextResponse.json({ ok: true }, { status: 200 });
}
