import { NextResponse } from 'next/server';

import type { MessageMentionVM } from '@iconicedu/shared-types';
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

export async function GET() {
  const { supabase, actor } = await resolveActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  try {
    const api = createApiClient(supabase);
    const data = await api.get('/scheduled-messages', {
      orgId: actor.account.org_id,
      senderProfileId: actor.profile.id,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to load scheduled messages',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    content?: string;
    mentions?: MessageMentionVM[];
    threadParentId?: string | null;
    threadId?: string | null;
    sendAt?: string;
    timezone?: string | null;
  } | null;

  if (!body?.channelId || !body?.content?.trim() || !body?.sendAt) {
    return NextResponse.json(
      { success: false, message: 'channelId, content, and sendAt are required' },
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
    const data = await api.post('/scheduled-messages', {
      orgId: actor.account.org_id,
      channelId: body.channelId,
      senderProfileId: actor.profile.id,
      content: body.content,
      mentions: body.mentions,
      threadParentId: body.threadParentId ?? null,
      threadId: body.threadId ?? null,
      sendAt: body.sendAt,
      timezone: body.timezone ?? null,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to schedule message',
      },
      { status: 500 },
    );
  }
}
