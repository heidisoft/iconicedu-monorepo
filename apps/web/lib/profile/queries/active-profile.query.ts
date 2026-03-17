import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProfileRow } from '@iconicedu/shared-types';

import { updateAccountActiveProfile } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { PROFILE_SELECT } from '@iconicedu/web/lib/profile/constants/selects';

export type ActiveProfileResolutionSource = 'active_profile_id' | 'fallback-healed';

export type ActiveProfileResolution = {
  profile: ProfileRow;
  source: ActiveProfileResolutionSource;
};

export async function resolveActiveProfileForAccountInOrg(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    orgId: string;
    activeProfileId: string | null;
    updatedByAuthUserId?: string | null;
  },
): Promise<ActiveProfileResolution> {
  if (input.activeProfileId) {
    const activeProfileResponse = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', input.activeProfileId)
      .eq('org_id', input.orgId)
      .eq('account_id', input.accountId)
      .is('deleted_at', null)
      .maybeSingle<ProfileRow>();

    if (activeProfileResponse.error) {
      throw new Error(activeProfileResponse.error.message);
    }
    if (activeProfileResponse.data) {
      return {
        profile: activeProfileResponse.data,
        source: 'active_profile_id',
      };
    }
  }

  const fallbackProfileResponse = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('org_id', input.orgId)
    .eq('account_id', input.accountId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ProfileRow>();

  if (fallbackProfileResponse.error) {
    throw new Error(fallbackProfileResponse.error.message);
  }
  if (!fallbackProfileResponse.data) {
    throw new Error(
      'No active persona profile found for this account in this organization.',
    );
  }

  const healResponse = await updateAccountActiveProfile(supabase, {
    accountId: input.accountId,
    orgId: input.orgId,
    activeProfileId: fallbackProfileResponse.data.id,
    updatedBy: input.updatedByAuthUserId ?? null,
  });
  if (healResponse.error) {
    throw new Error(healResponse.error.message);
  }

  return {
    profile: fallbackProfileResponse.data,
    source: 'fallback-healed',
  };
}
