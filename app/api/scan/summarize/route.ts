import { NextRequest, NextResponse } from 'next/server';

import { ScanSchema } from '@/lib/parser/schema';
import { AiNotConfiguredError, summarizeScan } from '@/lib/ai/summarize';

// Generates an AI summary for a parsed scan. Stateless: the client sends the
// scan, we return the AI `summary` for it to merge and persist. The rule-based
// summary stays as the fallback, so failures never overwrite good data.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid scan payload' },
      { status: 400 },
    );
  }

  try {
    const summary = await summarizeScan(parsed.data);
    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: 'AI is not configured on the server.' },
        { status: 503 },
      );
    }
    console.error('Error generating AI summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI summary' },
      { status: 500 },
    );
  }
}
