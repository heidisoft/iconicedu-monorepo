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
  const scopeKind = searchParams.get('scopeKind');
  const scopeId = searchParams.get('scopeId');
  if (!scopeKind || !scopeId) {
    return NextResponse.json(
      { success: false, message: 'scopeKind and scopeId are required' },
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
    const data = await api.get<{ mode: string; mutedUntil: string | null }>(
      '/notification-preferences/conversation-mode',
      {
        orgId: actor.account.org_id,
        profileId: actor.profile.id,
        scopeKind,
        scopeId,
      },
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to load notification mode',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    scopeKind?: string;
    scopeId?: string;
    mode?: string;
    mutedUntil?: string | null;
  } | null;

  const scopeKind = body?.scopeKind;
  const scopeId = body?.scopeId;
  const mode = body?.mode;
  if (!scopeKind || !scopeId || !mode) {
    return NextResponse.json(
      { success: false, message: 'scopeKind, scopeId, and mode are required' },
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
    await api.post('/notification-preferences/conversation-mode', {
      orgId: actor.account.org_id,
      profileId: actor.profile.id,
      scopeKind,
      scopeId,
      mode,
      mutedUntil: body?.mutedUntil ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to set notification mode',
      },
      { status: 500 },
    );
  }
}
