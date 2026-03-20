import { after, NextResponse } from 'next/server';

import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createOrJoinLiveSession } from '@iconicedu/web/lib/live-sessions/service';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';
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
    const serviceSupabase = createSupabaseServiceClient();
    const orgResponse = await getOrgBySlug(serviceSupabase, body.orgSlug);
    if (orgResponse.error) {
      throw new Error(orgResponse.error.message);
    }
    if (!orgResponse.data) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 },
      );
    }
    const actor = await requireEffectiveActorContext(supabase, {
      orgId: orgResponse.data.id,
    });
    console.info('[live-session:debug][api-join] resolved actor', {
      channelId,
      authUserId: actor.authUserId,
      accountId: actor.account.id,
      profileId: actor.profile.id,
      orgSlug: body.orgSlug,
    });

    const result = await createOrJoinLiveSession({
      serviceSupabase,
      actor: {
        authUserId: actor.authUserId,
        account: actor.account,
        profile: actor.profile,
      },
      channelId,
      orgSlug: body.orgSlug,
      schedulePostJoinSideEffects: (task) => {
        console.info('[live-session:debug][api-join] scheduling post-join side effects', {
          channelId,
          authUserId: actor.authUserId,
        });
        after(task);
      },
    });
    console.info('[live-session:debug][api-join] createOrJoinLiveSession result', {
      channelId,
      authUserId: actor.authUserId,
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
