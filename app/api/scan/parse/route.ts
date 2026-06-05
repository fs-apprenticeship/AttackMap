import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { parseNmapScan } from '@/lib/parser/parse-nmap';
import { saveScan } from '@/lib/scans/store';

// Parses an uploaded Nmap XML file, persists it to the database, and returns the
// normalized scan. Persisting server-side (rather than trusting the client to
// write) keeps the DB the source of truth and is where Clerk userId scoping will
// attach later.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Nmap XML file.' },
        { status: 400 },
      );
    }

    const xml = await file.text();
    const scan = parseNmapScan(xml, file.name);

    await saveScan(scan);
    revalidatePath('/');
    revalidatePath('/scans');

    return NextResponse.json(scan, { status: 201 });
  } catch (error) {
    console.error('Error parsing Nmap scan:', error);
    return NextResponse.json({ error: 'Failed to parse Nmap scan' }, { status: 500 });
  }
}
