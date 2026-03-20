import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { buildMessagesPageByChannelId } from '@iconicedu/web/lib/messages/builders/message.builder';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const orgId = searchParams.get('orgId')?.trim() || undefined;
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
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase, orgId ? { orgId } : undefined);
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const page = await buildMessagesPageByChannelId(
    supabase,
    actor.account.org_id,
    channelId,
    {
      limit,
      beforeCreatedAt: before,
      profileId: actor.profile.id,
    },
  );

  return NextResponse.json({
    success: true,
    messages: page.messages,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  });
}
