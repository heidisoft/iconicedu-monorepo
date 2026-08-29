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

    if (!body?.orgSlug) {
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
        after(task);
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to join live session';
    const status = message === 'Unauthorized' ? 403 : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
