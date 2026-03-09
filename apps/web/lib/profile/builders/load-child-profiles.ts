import type { ChildProfileVM, GradeLevel, UserProfileVM } from '@iconicedu/shared-types';
import type {
  ChildProfileGradeLevelRow,
  ChildProfileRow,
  ProfileRow,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveProfileAvatarUrl } from '@iconicedu/web/lib/profile/avatar-url';
import { mapBaseProfile } from '@iconicedu/web/lib/profile/mappers/base-profile.mapper';
import { getChildProfilesDetails } from '@iconicedu/web/lib/profile/queries/child.query';
import { getChildProfilesByAccountIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getAccountsByIds } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { parseGradeLevel } from '@iconicedu/shared-types';

async function resolveAvatarUrl(
  supabase: SupabaseClient,
  avatarSource: string,
  avatarUrl: string | null,
) {
  return resolveProfileAvatarUrl(supabase, avatarSource, avatarUrl);
}

export async function loadChildProfiles(
  supabase: SupabaseClient,
  orgId: string,
  childAccountIds: string[],
): Promise<ChildProfileVM[]> {
  if (!childAccountIds.length) {
    return [];
  }

  const profiles = await getChildProfilesByAccountIds(supabase, orgId, childAccountIds);
  if (!profiles.data?.length) {
    return [];
  }

  const profileIds = profiles.data.map((row) => row.id);
  const { childRows, gradeRows } = await getChildProfilesDetails(supabase, profileIds);
  const accountIds = profiles.data.map((row) => row.account_id);
  const accountsResponse = await getAccountsByIds(supabase, orgId, accountIds);
  const accountById = new Map(
    (accountsResponse.data ?? []).map((account) => [account.id, account]),
  );

  const childByProfileId = new Map(
    ((childRows as ChildProfileRow[] | null) ?? []).map((row) => [row.profile_id, row]),
  );
  const gradeByProfileId = new Map(
    ((gradeRows as ChildProfileGradeLevelRow[] | null) ?? []).map((row) => [
      row.profile_id,
      row,
    ]),
  );

  const profilesWithAvatar = await Promise.all(
    profiles.data.map(async (row) => ({
      row,
      avatarUrl: await resolveAvatarUrl(
        supabase,
        row.avatar_source,
        row.avatar_url ?? null,
      ),
    })),
  );

  return profilesWithAvatar.map(({ row, avatarUrl }) => {
    const baseProfile: Omit<UserProfileVM, 'kind'> = mapBaseProfile(row as ProfileRow, {
      notificationDefaults: null,
      notificationScopedDefaults: null,
      presence: null,
      avatarUrlOverride: avatarUrl,
    });
    const child = childByProfileId.get(row.id);
    const grade = gradeByProfileId.get(row.id);
    const gradeLevel: GradeLevel | null = grade
      ? (parseGradeLevel(grade.grade_id) ??
        parseGradeLevel(grade.grade_label ?? grade.grade_id))
      : null;

    const account = accountById.get(row.account_id);
    return {
      ...baseProfile,
      kind: 'child',
      accountAuthUserId: account?.auth_user_id ?? null,
      gradeLevel,
      birthYear: child?.birth_year ?? null,
      schoolName: child?.school_name ?? null,
      schoolYear: child?.school_year ?? null,
      interests: child?.interests ?? null,
      strengths: child?.strengths ?? null,
      learningPreferences: child?.learning_preferences ?? null,
      motivationStyles: child?.motivation_styles ?? null,
      confidenceLevel: child?.confidence_level ?? null,
      communicationStyles: child?.communication_styles ?? null,
      accountEmail: account?.email ?? null,
    };
  });
}
