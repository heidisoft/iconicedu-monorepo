import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { buildMessageById } from '@iconicedu/web/lib/messages/builders/message.builder';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

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

  const message = await buildMessageById(supabase, actor.account.org_id, messageId, {
    accountId: actor.account.id,
    profileId: actor.profile.id,
  });

  if (!message) {
    return NextResponse.json(
      { success: false, message: 'Message not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, message });
}
