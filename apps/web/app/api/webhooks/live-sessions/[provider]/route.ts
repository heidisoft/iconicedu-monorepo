import { NextResponse } from 'next/server';

import type { LiveSessionProviderVM } from '@iconicedu/shared-types';
import { processLiveSessionProviderWebhook } from '@iconicedu/web/lib/live-sessions/service';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

function isSupportedProvider(value: string): value is LiveSessionProviderVM {
  return value === 'daily' || value === 'zoom' || value === 'jitsi' || value === 'custom';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await context.params;
    if (!isSupportedProvider(provider)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported provider' },
        { status: 404 },
      );
    }

    const body = await request.text();
    const result = await processLiveSessionProviderWebhook({
      supabase: createSupabaseServiceClient(),
      provider,
      headers: request.headers,
      body,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to process live session webhook';
    const status = message.includes('signature') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
