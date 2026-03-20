import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { buildMessagesByThreadId } from '@iconicedu/web/lib/messages/builders/message.builder';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

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

  const messages = await buildMessagesByThreadId(
    supabase,
    actor.account.org_id,
    threadId,
    {
      accountId: actor.account.id,
      profileId: actor.profile.id,
      parentMessageId,
    },
  );

  return NextResponse.json({ success: true, messages });
}
