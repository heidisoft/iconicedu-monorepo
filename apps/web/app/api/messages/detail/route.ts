import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildMessageById } from '@iconicedu/web/lib/messages/builders/message.builder';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get('messageId');

  if (!messageId) {
    return NextResponse.json(
      { success: false, message: 'messageId is required' },
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

  const message = await buildMessageById(
    supabase,
    accountResponse.data.org_id,
    messageId,
    { accountId: accountResponse.data.id },
  );

  if (!message) {
    return NextResponse.json(
      { success: false, message: 'Message not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, message });
}
