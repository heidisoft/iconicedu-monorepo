import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

function isThreadUnreadDebugEnabled() {
  return process.env.DEBUG_THREAD_UNREAD?.trim() === 'true';
}

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

  const threadLookup = await supabase
    .from('threads')
    .select('id, channel_id')
    .eq('org_id', actor.account.org_id)
    .eq('id', threadId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; channel_id: string }>();

  if (threadLookup.error) {
    return NextResponse.json(
      { success: false, message: threadLookup.error.message },
      { status: 500 },
    );
  }

  if (!threadLookup.data) {
    return NextResponse.json(
      { success: false, message: 'Thread not found or access denied' },
      { status: 403 },
    );
  }

  const participantLookup = await supabase
    .from('thread_participants')
    .select('id')
    .eq('org_id', actor.account.org_id)
    .eq('thread_id', threadId)
    .eq('profile_id', actor.profile.id)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (participantLookup.error) {
    return NextResponse.json(
      { success: false, message: participantLookup.error.message },
      { status: 500 },
    );
  }

  if (!participantLookup.data) {
    return NextResponse.json(
      { success: false, message: 'Thread not found or access denied' },
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
      .eq('thread_id', threadId)
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
        { success: false, message: 'Invalid lastReadMessageId for thread' },
        { status: 400 },
      );
    }
  }

  const now = new Date().toISOString();

  if (isThreadUnreadDebugEnabled()) {
    console.info('[thread-unread][api][request]', {
      orgId: actor.account.org_id,
      channelId,
      threadId,
      accountId: actor.account.id,
      profileId: actor.profile.id,
      requestedLastReadMessageId,
      now,
    });
  }

  const recomputeResponse = await supabase.rpc('recompute_unread_for_account_thread', {
    p_org_id: actor.account.org_id,
    p_channel_id: channelId,
    p_thread_id: threadId,
    p_account_id: actor.account.id,
    p_last_read_message_id: requestedLastReadMessageId,
    p_last_read_at: now,
    p_actor_profile_id: actor.profile.id,
  });

  if (recomputeResponse.error) {
    return NextResponse.json(
      { success: false, message: recomputeResponse.error.message },
      { status: 500 },
    );
  }

  const unreadCount =
    typeof recomputeResponse.data === 'number' ? recomputeResponse.data : undefined;

  if (isThreadUnreadDebugEnabled()) {
    console.info('[thread-unread][api][response]', {
      threadId,
      lastReadMessageId: requestedLastReadMessageId,
      unreadCount,
      lastReadAt: now,
    });
  }

  return NextResponse.json({
    success: true,
    unreadCount,
    lastReadAt: now,
    lastReadMessageId: requestedLastReadMessageId,
  });
}
