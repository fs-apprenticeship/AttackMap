import { NextRequest, NextResponse } from 'next/server';

import { ScanSchema } from '@/lib/parser/schema';
import { AiNotConfiguredError } from '@/lib/ai/summarize';
import { generateRemediationPlan } from '@/lib/ai/remediate';

// Generates an AI remediation plan for a parsed scan. Stateless: the client
// sends the scan, we return the plan for it to merge and persist. The
// rule-based plan stays as the fallback, so failures never overwrite good data.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scan payload' }, { status: 400 });
  }

  try {
    const remediationPlan = await generateRemediationPlan(parsed.data);
    return NextResponse.json({ remediationPlan }, { status: 200 });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: 'AI is not configured on the server.' },
        { status: 503 },
      );
    }
    console.error('Error generating remediation plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate remediation plan' },
      { status: 500 },
    );
  }
}
