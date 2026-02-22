import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildMessagesPageByChannelId } from '@iconicedu/web/lib/messages/builders/message.builder';

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const before = searchParams.get('before');
  const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(rawLimit)))
    : DEFAULT_PAGE_SIZE;

  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
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

  const page = await buildMessagesPageByChannelId(
    supabase,
    accountResponse.data.org_id,
    channelId,
    {
      limit,
      beforeCreatedAt: before,
    },
  );

  return NextResponse.json({
    success: true,
    messages: page.messages,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  });
}
