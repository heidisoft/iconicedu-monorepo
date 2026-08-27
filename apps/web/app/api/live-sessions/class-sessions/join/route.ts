import { NextResponse } from 'next/server';

import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createLiveSessionsApiClient } from '@iconicedu/web/lib/live-sessions/api-client';
import { resolveLiveSessionJoinErrorResponse } from '@iconicedu/web/lib/live-sessions/join-errors';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type JoinOccurrenceBody = {
  orgSlug?: string;
  scheduleId?: string;
  occurrenceKey?: string;
};

/**
 * Join one exact class-session occurrence (issue #195).
 *
 * The occurrence is addressed by base schedule + original occurrence key, so an
 * early click on a future card creates or reuses the room for *that* occurrence
 * instead of an unrelated channel-scoped huddle.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as JoinOccurrenceBody | null;

    if (!body?.orgSlug || !body.scheduleId || !body.occurrenceKey) {
      return NextResponse.json(
        { success: false, error: 'orgSlug, scheduleId and occurrenceKey are required' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const orgResponse = await getOrgBySlug(createSupabaseServiceClient(), body.orgSlug);
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

    const result = await createLiveSessionsApiClient(supabase).joinClassSessionOccurrence(
      {
        orgSlug: body.orgSlug,
        scheduleId: body.scheduleId,
        occurrenceKey: body.occurrenceKey,
        actingProfileId: actor.profile.id,
      },
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return resolveLiveSessionJoinErrorResponse(error);
  }
}
