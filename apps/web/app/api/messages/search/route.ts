import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const query = searchParams.get('query');
  if (!channelId || !query?.trim()) {
    return NextResponse.json(
      { success: false, message: 'channelId and query are required' },
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
    const data = await api.get('/message-search', {
      orgId: actor.account.org_id,
      channelId,
      query,
      profileId: actor.profile.id,
      accountId: actor.account.id,
      senderProfileId: searchParams.get('senderProfileId') ?? undefined,
      createdAfter: searchParams.get('createdAfter') ?? undefined,
      createdBefore: searchParams.get('createdBefore') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to search messages',
      },
      { status: 500 },
    );
  }
}
