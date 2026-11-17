import { NextResponse } from 'next/server';

import type { AiSuggestedRepliesResult } from '@iconicedu/shared-types';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { channelId?: string } | null;

  const channelId = body?.channelId?.trim();
  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 },
      );
    }
    throw error;
  }
  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  try {
    const api = createApiClient(supabase);
    const result = await api.post<AiSuggestedRepliesResult>(
      '/ai-assist/suggested-replies',
      {
        orgId: actor.account.org_id,
        channelId,
        profileId: actor.profile.id,
      },
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load suggested replies';
    const status = /limit|not available|not a member/i.test(message) ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
