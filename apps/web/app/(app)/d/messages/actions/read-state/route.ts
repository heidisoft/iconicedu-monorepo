import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { channelId?: string; lastReadMessageId?: string | null }
    | null;

  const channelId = body?.channelId?.trim();
  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
  const account = accountResponse.data;

  if (!account) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const channelLookup = await supabase
    .from('channels')
    .select('id')
    .eq('org_id', account.org_id)
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

  const requestedLastReadMessageId = body?.lastReadMessageId ?? null;
  if (requestedLastReadMessageId) {
    const messageLookup = await supabase
      .from('messages')
      .select('id')
      .eq('org_id', account.org_id)
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

  const { error } = await supabase.from('channel_read_state').upsert(
    {
      org_id: account.org_id,
      account_id: account.id,
      channel_id: channelId,
      last_read_message_id: requestedLastReadMessageId,
      last_read_at: now,
      unread_count: 0,
    },
    { onConflict: 'org_id,channel_id,account_id' },
  );

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
