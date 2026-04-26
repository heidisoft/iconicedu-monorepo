import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    threadId?: string;
    lastReadMessageId?: string | null;
  } | null;

  const channelId = body?.channelId?.trim();
  const threadId = body?.threadId?.trim();

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  if (!threadId) {
    return NextResponse.json(
      { success: false, message: 'threadId is required' },
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

  const requestedLastReadMessageId = body?.lastReadMessageId ?? null;
  const now = new Date().toISOString();

  try {
    const api = createApiClient(supabase);
    const response = await api.post<{ unreadCount?: number }>(
      `/channels/${channelId}/read-state`,
      {
        orgId: actor.account.org_id,
        channelId,
        threadId,
        accountId: actor.account.id,
        profileId: actor.profile.id,
        lastReadMessageId: requestedLastReadMessageId,
      },
    );

    return NextResponse.json({
      success: true,
      unreadCount: response.unreadCount,
      lastReadAt: now,
      lastReadMessageId: requestedLastReadMessageId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to mark thread read',
      },
      { status: 500 },
    );
  }
}
