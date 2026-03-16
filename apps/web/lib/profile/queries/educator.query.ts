import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DayAvailability,
  EducatorAvailabilityRow,
  EducatorProfileBadgeRow,
  EducatorProfileCurriculumTagRow,
  EducatorProfileGradeLevelRow,
  EducatorProfileRow,
  EducatorProfileSubjectRow,
} from '@iconicedu/shared-types';

import {
  EDUCATOR_AVAILABILITY_SELECT,
  EDUCATOR_BADGES_SELECT,
  EDUCATOR_CURRICULUM_TAGS_SELECT,
  EDUCATOR_GRADE_LEVELS_SELECT,
  EDUCATOR_PROFILE_SELECT,
  EDUCATOR_SUBJECTS_SELECT,
} from '@iconicedu/web/lib/profile/constants/selects';

export async function getEducatorProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('educator_profiles')
    .select(EDUCATOR_PROFILE_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<EducatorProfileRow>();
}

export async function getEducatorSubjects(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('educator_profile_subjects')
    .select(EDUCATOR_SUBJECTS_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .returns<EducatorProfileSubjectRow[]>();
}

export async function getEducatorGradeLevels(
  supabase: SupabaseClient,
  profileId: string,
) {
  return supabase
    .from('educator_profile_grade_levels')
    .select(EDUCATOR_GRADE_LEVELS_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .returns<EducatorProfileGradeLevelRow[]>();
}

export async function getEducatorCurriculumTags(
  supabase: SupabaseClient,
  profileId: string,
) {
  return supabase
    .from('educator_profile_curriculum_tags')
    .select(EDUCATOR_CURRICULUM_TAGS_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .returns<EducatorProfileCurriculumTagRow[]>();
}

export async function getEducatorBadges(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from('educator_profile_badges')
    .select(EDUCATOR_BADGES_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .returns<EducatorProfileBadgeRow[]>();
}

export async function getEducatorAvailability(
  supabase: SupabaseClient,
  profileId: string,
) {
  return supabase
    .from('educator_availabilities')
    .select(EDUCATOR_AVAILABILITY_SELECT)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<EducatorAvailabilityRow>();
}

export type EducatorAvailabilityUpsertInput = {
  profileId: string;
  orgId: string;
  classTypes?: string[] | null;
  weeklyCommitment?: number | null;
  availability?: DayAvailability | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export async function upsertEducatorAvailability(
  supabase: SupabaseClient,
  input: EducatorAvailabilityUpsertInput,
) {
  return supabase
    .from('educator_availabilities')
    .upsert(
      {
        profile_id: input.profileId,
        org_id: input.orgId,
        class_types: input.classTypes ?? null,
        weekly_commitment: input.weeklyCommitment ?? null,
        availability: input.availability ?? null,
        created_by: input.createdBy ?? null,
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: 'profile_id' },
    )
    .select(EDUCATOR_AVAILABILITY_SELECT)
    .maybeSingle<EducatorAvailabilityRow>();
}
