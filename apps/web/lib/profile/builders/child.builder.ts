import type { ChildProfileVM, GradeLevel, UserProfileVM } from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getChildGradeLevel,
  getChildProfile,
} from '@iconicedu/web/lib/profile/queries/child.query';
import { parseGradeLevel } from '@iconicedu/shared-types';

export async function buildChildProfile(
  supabase: SupabaseClient,
  baseProfile: Omit<UserProfileVM, 'kind'>,
  profileRow: ProfileRow,
): Promise<ChildProfileVM> {
  const [child, grade] = await Promise.all([
    getChildProfile(supabase, profileRow.id),
    getChildGradeLevel(supabase, profileRow.id),
  ]);

  const gradeLevel: GradeLevel | null = grade.data
    ? (parseGradeLevel(grade.data.grade_id) ??
      parseGradeLevel(grade.data.grade_label ?? grade.data.grade_id))
    : null;

  return {
    ...baseProfile,
    kind: 'child',
    gradeLevel,
    birthYear: child.data?.birth_year ?? null,
    schoolName: child.data?.school_name ?? null,
    schoolYear: child.data?.school_year ?? null,
    interests: child.data?.interests ?? null,
    strengths: child.data?.strengths ?? null,
    learningPreferences: child.data?.learning_preferences ?? null,
    motivationStyles: child.data?.motivation_styles ?? null,
    confidenceLevel: child.data?.confidence_level ?? null,
    communicationStyles: child.data?.communication_styles ?? null,
  };
}
