import { NextResponse } from 'next/server';

import { dispatchDueNotificationJobs } from '@iconicedu/web/lib/notifications/dispatch-jobs';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.INTERNAL_NOTIFICATIONS_TOKEN;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    limit?: number;
    leaseSeconds?: number;
    leaseOwner?: string;
  } | null;

  const supabase = createSupabaseServiceClient();
  const result = await dispatchDueNotificationJobs({
    supabase,
    leaseOwner:
      typeof body?.leaseOwner === 'string' && body.leaseOwner.trim().length > 0
        ? body.leaseOwner.trim()
        : 'internal-notifications-dispatch',
    limit: typeof body?.limit === 'number' ? body.limit : undefined,
    leaseSeconds: typeof body?.leaseSeconds === 'number' ? body.leaseSeconds : undefined,
  });

  return NextResponse.json(result);
}
