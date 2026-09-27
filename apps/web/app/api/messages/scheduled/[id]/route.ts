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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    content?: string;
    mentions?: MessageMentionVM[];
    sendAt?: string;
    timezone?: string | null;
  } | null;

  const { supabase, actor } = await resolveActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  try {
    const api = createApiClient(supabase);
    const data = await api.put(`/scheduled-messages/${id}`, {
      orgId: actor.account.org_id,
      content: body?.content,
      mentions: body?.mentions,
      sendAt: body?.sendAt,
      timezone: body?.timezone,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to update scheduled message',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { supabase, actor } = await resolveActor();
  if (!actor) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  try {
    const api = createApiClient(supabase);
    await api.delete(`/scheduled-messages/${id}?orgId=${actor.account.org_id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to cancel scheduled message',
      },
      { status: 500 },
    );
  }
}
