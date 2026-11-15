import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

async function resolveActor() {
  const supabase = await createSupabaseServerClient();
  try {
    const actor = await requireEffectiveActorContext(supabase);
    return { supabase, actor };
  } catch (error) {
    if (error instanceof Error && error.message === 'Account not found') {
      return { supabase, actor: null };
    }
    throw error;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json(
      { success: false, message: 'channelId is required' },
      { status: 400 },
    );
  }

  const { supabase, actor } = await resolveActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  try {
    const api = createApiClient(supabase);
    const data = await api.get('/message-pins', {
      orgId: actor.account.org_id,
      channelId,
      profileId: actor.profile.id,
      accountId: actor.account.id,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to load pinned messages',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    messageId?: string;
    isPinned?: boolean;
  } | null;

  const channelId = body?.channelId;
  const messageId = body?.messageId;
  if (!channelId || !messageId || typeof body?.isPinned !== 'boolean') {
    return NextResponse.json(
      { success: false, message: 'channelId, messageId, and isPinned are required' },
      { status: 400 },
    );
  }

  const { supabase, actor } = await resolveActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  try {
    const api = createApiClient(supabase);
    await api.post('/message-pins', {
      orgId: actor.account.org_id,
      channelId,
      messageId,
      isPinned: body.isPinned,
      profileId: actor.profile.id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to update pinned message',
      },
      { status: 500 },
    );
  }
}
