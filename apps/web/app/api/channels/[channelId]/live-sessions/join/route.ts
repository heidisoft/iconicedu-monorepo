import { NextResponse } from 'next/server';

import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createLiveSessionsApiClient } from '@iconicedu/web/lib/live-sessions/api-client';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { resolveLiveSessionJoinErrorResponse } from '@iconicedu/web/lib/live-sessions/join-errors';

/**
 * Browser-facing channel join. The live-session business logic now lives in
 * `apps/api` (issue #195); this handler only resolves who is acting — including a
 * guardian browsing as a linked child — and forwards to the API.
 */
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

    const result = await createLiveSessionsApiClient(supabase).joinChannelLiveSession({
      channelId,
      orgSlug: body.orgSlug,
      actingProfileId: actor.profile.id,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return resolveLiveSessionJoinErrorResponse(error);
  }
}
