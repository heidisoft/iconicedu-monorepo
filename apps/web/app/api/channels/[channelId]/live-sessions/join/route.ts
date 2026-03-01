import { NextResponse } from 'next/server';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { createOrJoinLiveSession } from '@iconicedu/web/lib/live-sessions/service';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await context.params;
    const body = (await request.json().catch(() => null)) as { orgSlug?: string } | null;

    if (!body?.orgSlug) {
      return NextResponse.json(
        { success: false, error: 'orgSlug is required' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const authUser = await requireAuthedUser(supabase);
    const serviceSupabase = createSupabaseServiceClient();

    const result = await createOrJoinLiveSession({
      supabase,
      serviceSupabase,
      authUserId: authUser.id,
      channelId,
      orgSlug: body.orgSlug,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join live session';
    const status = message === 'Unauthorized' ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
