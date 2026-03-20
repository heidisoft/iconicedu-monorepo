import { NextResponse } from 'next/server';

import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getNotificationPolicyConfig } from '@iconicedu/web/lib/notifications/policy-config';
import { resolveEffectivePreference } from '@iconicedu/web/lib/notifications/resolve-effective-preference';

function normalizeScope(input: { scopeKind?: unknown; scopeId?: unknown }) {
  if (input.scopeKind === 'channel' && typeof input.scopeId === 'string') {
    return { kind: 'channel', channelId: input.scopeId };
  }
  if (input.scopeKind === 'learning_space' && typeof input.scopeId === 'string') {
    return { kind: 'learning_space', learningSpaceId: input.scopeId };
  }
  return { kind: 'global' };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    orgId?: string;
    profileId?: string;
    prefKey?: string;
    scopeKind?: 'channel' | 'learning_space';
    scopeId?: string;
  } | null;

  if (!body?.orgId || !body.profileId || !body.prefKey) {
    return NextResponse.json(
      { success: false, message: 'orgId, profileId and prefKey are required.' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  try {
    const actor = await requireEffectiveActorContext(supabase, { orgId: body.orgId });
    if (actor.profile.id !== body.profileId || actor.account.org_id !== body.orgId) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const effective = await resolveEffectivePreference({
      supabase,
      event: {
        id: 'effective-preview-event-id',
        org_id: body.orgId,
        event_type: body.prefKey,
        occurred_at: new Date().toISOString(),
        source_kind: 'system',
        actor_profile_id: null,
        scope: normalizeScope({
          scopeKind: body.scopeKind,
          scopeId: body.scopeId,
        }),
        object_ref: null,
        target_ref: null,
        payload: {},
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      recipientProfileId: body.profileId,
      defaultChannels: ['push', 'email'],
    });

    return NextResponse.json({
      success: true,
      data: {
        prefKey: body.prefKey,
        source: effective.source,
        muted: effective.muted,
        channels: effective.channels,
        scopeKind: effective.scopeKind,
        scopeId: effective.scopeId,
        policy: getNotificationPolicyConfig(body.prefKey),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
