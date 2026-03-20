import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    lastReadMessageId?: string | null;
  } | null;

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

  const now = new Date().toISOString();
  const channelLookup = await supabase
    .from('channels')
    .select('id')
    .eq('org_id', actor.account.org_id)
    .eq('id', channelId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (channelLookup.error) {
    return NextResponse.json(
      { success: false, message: channelLookup.error.message },
      { status: 500 },
    );
  }

  if (!channelLookup.data) {
    return NextResponse.json(
      { success: false, message: 'Channel not found or access denied' },
      { status: 403 },
    );
  }
  const membershipLookup = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', actor.account.org_id)
    .eq('channel_id', channelId)
    .eq('profile_id', actor.profile.id)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (membershipLookup.error) {
    return NextResponse.json(
      { success: false, message: membershipLookup.error.message },
      { status: 500 },
    );
  }

  if (!membershipLookup.data) {
    return NextResponse.json(
      { success: false, message: 'Channel not found or access denied' },
      { status: 403 },
    );
  }

  const requestedLastReadMessageId = body?.lastReadMessageId ?? null;
  if (requestedLastReadMessageId) {
    const messageLookup = await supabase
      .from('messages')
      .select('id')
      .eq('org_id', actor.account.org_id)
      .eq('channel_id', channelId)
      .eq('id', requestedLastReadMessageId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (messageLookup.error) {
      return NextResponse.json(
        { success: false, message: messageLookup.error.message },
        { status: 500 },
      );
    }

    if (!messageLookup.data) {
      return NextResponse.json(
        { success: false, message: 'Invalid lastReadMessageId for channel' },
        { status: 400 },
      );
    }
  }

  const recomputeResponse = await supabase.rpc('recompute_unread_for_account_channel', {
    p_org_id: actor.account.org_id,
    p_channel_id: channelId,
    p_account_id: actor.account.id,
    p_last_read_message_id: requestedLastReadMessageId,
    p_last_read_at: now,
    p_actor_profile_id: actor.profile.id,
  });

  const { error } = recomputeResponse;

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    unreadCount:
      typeof recomputeResponse.data === 'number' ? recomputeResponse.data : undefined,
  });
}
