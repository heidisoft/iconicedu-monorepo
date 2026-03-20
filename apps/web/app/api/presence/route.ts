import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import {
  mapConnectionStatusToDisplayStatus,
  mapConnectionStatusToLiveStatus,
  type PresenceConnectionStatus,
} from '@iconicedu/web/lib/presence/status';

type PresenceBody = {
  status?: PresenceConnectionStatus;
  stateText?: string | null;
  stateEmoji?: string | null;
  stateExpiresAt?: string | null;
  clearState?: boolean;
};

const VALID_STATUS: ReadonlySet<PresenceConnectionStatus> = new Set([
  'online',
  'away',
  'offline',
]);

function parsePresenceBody(rawBody: string | null): PresenceBody | null {
  if (!rawBody?.trim()) {
    return {};
  }
  try {
    return JSON.parse(rawBody) as PresenceBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => null);
  const body = parsePresenceBody(rawBody);

  if (!body) {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const status: PresenceConnectionStatus = VALID_STATUS.has(body.status ?? 'online')
    ? (body.status ?? 'online')
    : 'online';
  const shouldClearState = body.clearState === true;
  const hasStateText = Object.prototype.hasOwnProperty.call(body, 'stateText');
  const hasStateEmoji = Object.prototype.hasOwnProperty.call(body, 'stateEmoji');
  const hasStateExpiresAt = Object.prototype.hasOwnProperty.call(body, 'stateExpiresAt');

  const parseOptionalDate = (value?: string | null) => {
    if (!value?.trim()) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  };

  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }
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
      { success: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const now = new Date().toISOString();
  const serviceClient = createSupabaseServiceClient();
  const upsertPayload: Record<string, unknown> = {
    org_id: actor.account.org_id,
    profile_id: actor.profile.id,
    live_status: mapConnectionStatusToLiveStatus(status),
    display_status: mapConnectionStatusToDisplayStatus(status),
    last_seen_at: now,
    presence_loaded: true,
  };

  if (shouldClearState) {
    upsertPayload.state_text = null;
    upsertPayload.state_emoji = null;
    upsertPayload.state_expires_at = null;
  } else {
    if (hasStateText) {
      upsertPayload.state_text = body.stateText?.trim() ? body.stateText.trim() : null;
    }
    if (hasStateEmoji) {
      upsertPayload.state_emoji = body.stateEmoji?.trim() ? body.stateEmoji.trim() : null;
    }
    if (hasStateExpiresAt) {
      upsertPayload.state_expires_at = parseOptionalDate(body.stateExpiresAt);
    }
  }

  const { error } = await serviceClient
    .from('profile_presence')
    .upsert(upsertPayload, { onConflict: 'org_id,profile_id' });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
