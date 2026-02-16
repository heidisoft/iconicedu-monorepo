import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import {
  mapConnectionStatusToDisplayStatus,
  mapConnectionStatusToLiveStatus,
  type PresenceConnectionStatus,
} from '@iconicedu/web/lib/presence/status';

type PresenceBody = {
  status?: PresenceConnectionStatus;
  stateText?: string | null;
  stateEmoji?: string | null;
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

  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);
  const account = accountResponse.data;

  if (!account) {
    return NextResponse.json(
      { success: false, message: 'Account not found' },
      { status: 404 },
    );
  }

  const profileResponse = await getProfileByAccountId(supabase, account.id);
  const profile = profileResponse.data;
  if (!profile) {
    return NextResponse.json(
      { success: false, message: 'Profile not found' },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('profile_presence').upsert(
    {
      org_id: account.org_id,
      profile_id: profile.id,
      state_text: body.stateText ?? null,
      state_emoji: body.stateEmoji ?? null,
      live_status: mapConnectionStatusToLiveStatus(status),
      display_status: mapConnectionStatusToDisplayStatus(status),
      last_seen_at: now,
      presence_loaded: true,
    },
    { onConflict: 'org_id,profile_id' },
  );

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
