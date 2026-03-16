import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChildProfileGradeLevelRow, ChildProfileRow } from '@iconicedu/shared-types';

import {
  CHILD_GRADE_LEVEL_ROWS_SELECT,
  CHILD_GRADE_LEVEL_SELECT,
  CHILD_PROFILE_ROWS_SELECT,
  CHILD_PROFILE_SELECT,
} from '@iconicedu/web/lib/profile/constants/selects';

export async function getChildProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('child_profiles')
    .select(CHILD_PROFILE_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<ChildProfileRow>();
}

export async function getChildGradeLevel(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('child_profile_grade_level')
    .select(CHILD_GRADE_LEVEL_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<ChildProfileGradeLevelRow>();
}

export async function getChildProfilesDetails(
  supabase: SupabaseClient,
  profileIds: string[],
) {
  const [childRows, gradeRows] = await Promise.all([
    supabase
      .from('child_profiles')
      .select(CHILD_PROFILE_ROWS_SELECT)
      .in('profile_id', profileIds)
      .is('deleted_at', null)
      .returns<ChildProfileRow[]>(),
    supabase
      .from('child_profile_grade_level')
      .select(CHILD_GRADE_LEVEL_ROWS_SELECT)
      .in('profile_id', profileIds)
      .is('deleted_at', null)
      .returns<ChildProfileGradeLevelRow[]>(),
  ]);

  return { childRows: childRows.data ?? [], gradeRows: gradeRows.data ?? [] };
}
