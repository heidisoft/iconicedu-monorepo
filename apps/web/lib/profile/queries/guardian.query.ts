import type { SupabaseClient } from '@supabase/supabase-js';

import type { FamilyLinkRow, GuardianProfileRow } from '@iconicedu/shared-types';

import {
  FAMILY_LINKS_SELECT,
  GUARDIAN_PROFILE_SELECT,
} from '@iconicedu/web/lib/profile/constants/selects';

export async function getGuardianProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('guardian_profiles')
    .select(GUARDIAN_PROFILE_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<GuardianProfileRow>();
}

export async function getGuardianFamilyLinks(
  supabase: SupabaseClient,
  orgId: string,
  guardianAccountId: string,
) {
  return supabase
    .from('family_links')
    .select(FAMILY_LINKS_SELECT)
    .eq('guardian_account_id', guardianAccountId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .returns<FamilyLinkRow[]>();
}
