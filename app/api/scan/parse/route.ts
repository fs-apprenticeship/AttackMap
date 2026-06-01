import { NextRequest, NextResponse } from 'next/server';
import { parseNmapScan } from '@/lib/parser/parse-nmap';

// Parses an uploaded Nmap XML file and returns the normalized scan. Persistence
// is handled client-side (localStorage), so this route is stateless.
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

    return NextResponse.json(scan, { status: 201 });
  } catch (error) {
    console.error('Error parsing Nmap scan:', error);
    return NextResponse.json({ error: 'Failed to parse Nmap scan' }, { status: 500 });
  }
}
