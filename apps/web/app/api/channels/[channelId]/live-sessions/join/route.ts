import { after, NextResponse } from 'next/server';

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
    console.info('[live-session:debug][api-join] request received', {
      channelId,
      hasOrgSlug: Boolean(body?.orgSlug),
    });

    if (!body?.orgSlug) {
      console.info('[live-session:debug][api-join] rejecting request: missing orgSlug', {
        channelId,
      });
      return NextResponse.json(
        { success: false, error: 'orgSlug is required' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const authUser = await requireAuthedUser(supabase);
    const serviceSupabase = createSupabaseServiceClient();
    console.info('[live-session:debug][api-join] resolved auth', {
      channelId,
      authUserId: authUser.id,
      orgSlug: body.orgSlug,
    });

    const result = await createOrJoinLiveSession({
      supabase,
      serviceSupabase,
      authUserId: authUser.id,
      channelId,
      orgSlug: body.orgSlug,
      schedulePostJoinSideEffects: (task) => {
        console.info('[live-session:debug][api-join] scheduling post-join side effects', {
          channelId,
          authUserId: authUser.id,
        });
        after(task);
      },
    });
    console.info('[live-session:debug][api-join] createOrJoinLiveSession result', {
      channelId,
      authUserId: authUser.id,
      sessionId: result.sessionId,
      created: result.created,
      status: result.status,
      provider: result.provider,
      joinPath: result.joinPath,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to join live session';
    const status = message === 'Unauthorized' ? 403 : 500;
    console.error('[live-session:debug][api-join] request failed', {
      error: message,
      status,
    });
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
