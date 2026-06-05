import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { parseNmapScan } from "@/lib/parser/parse-nmap";
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

  if (!file.name.toLowerCase().endsWith(".xml"))
    return NextResponse.json(
      { error: "Invalid file type. Please upload an Nmap XML file." },
      { status: 400 },
    );

  try {
    const xml = await file.text();
    const scan = parseNmapScan(xml, file.name);
    await saveScan(scan, userId);
    revalidateTag(`scans:${userId}`);
    return NextResponse.json(scan, { status: 201 });
  } catch (error) {
    console.error("Error parsing Nmap scan:", error);
    return NextResponse.json({ error: "Failed to parse Nmap scan" }, { status: 500 });
  }
}
