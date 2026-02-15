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
  const { error } = await supabase.from('channel_read_state').upsert(
    {
      org_id: account.org_id,
      account_id: account.id,
      channel_id: channelId,
      last_read_message_id: body?.lastReadMessageId ?? null,
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
