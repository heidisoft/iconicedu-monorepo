import type { SupabaseClient } from '@supabase/supabase-js';

import type { StaffProfileRow, StaffProfileSpecialtyRow } from '@iconicedu/shared-types';

import {
  STAFF_PROFILE_SELECT,
  STAFF_SPECIALTIES_SELECT,
} from '@iconicedu/web/lib/profile/constants/selects';

export async function getStaffProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('staff_profiles')
    .select(STAFF_PROFILE_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<StaffProfileRow>();
}

export async function getStaffSpecialties(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('staff_profile_specialties')
    .select(STAFF_SPECIALTIES_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .returns<StaffProfileSpecialtyRow[]>();
}
