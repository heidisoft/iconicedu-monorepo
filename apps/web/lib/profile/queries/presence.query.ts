import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProfilePresenceRow } from '@iconicedu/shared-types';

import { PRESENCE_SELECT } from '@iconicedu/web/lib/profile/constants/selects';

export async function getPresence(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  return supabase
    .from('profile_presence')
    .select(PRESENCE_SELECT)
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<ProfilePresenceRow>();
}

export async function getPresenceByProfileIds(
  supabase: SupabaseClient,
  orgId: string,
  profileIds: string[],
) {
  if (!profileIds.length) {
    return { data: [] as ProfilePresenceRow[] };
  }

  return supabase
    .from('profile_presence')
    .select(PRESENCE_SELECT)
    .in('profile_id', profileIds)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<ProfilePresenceRow[]>();
}
