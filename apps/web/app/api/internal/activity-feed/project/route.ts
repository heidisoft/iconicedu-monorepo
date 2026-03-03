import { NextResponse } from 'next/server';

import { projectActivityEvents } from '@iconicedu/web/lib/activity-feed/projector/project-activity-events';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.INTERNAL_ACTIVITY_FEED_TOKEN;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { eventIds?: string[]; limit?: number }
    | null;

  const supabase = createSupabaseServiceClient();
  const result = await projectActivityEvents(supabase, {
    eventIds: Array.isArray(body?.eventIds) ? body?.eventIds : undefined,
    limit: typeof body?.limit === 'number' ? body.limit : undefined,
  });

  return NextResponse.json(result);
}
