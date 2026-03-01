import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildMessagesByThreadId } from '@iconicedu/web/lib/messages/builders/message.builder';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId');
  const parentMessageId = searchParams.get('parentMessageId');

  if (!threadId) {
    return NextResponse.json(
      { success: false, message: 'threadId is required' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);

  const messages = await buildMessagesByThreadId(
    supabase,
    accountResponse.data.org_id,
    threadId,
    {
      accountId: accountResponse.data.id,
      profileId: profileResponse.data?.id ?? undefined,
      parentMessageId,
    },
  );

  return NextResponse.json({ success: true, messages });
}
