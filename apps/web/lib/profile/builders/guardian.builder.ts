import type {
  ConnectionVM,
  ChildProfileVM,
  GuardianProfileVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getGuardianFamilyLinks, getGuardianProfile } from '@iconicedu/web/lib/profile/queries/guardian.query';
import { loadChildProfiles } from '@iconicedu/web/lib/profile/builders/load-child-profiles';

function normalizeSessionNotesVisibility(
  raw: string | null | undefined,
): 'private' | 'shared' | null {
  if (raw === 'private' || raw === 'shared') {
    return raw;
  }
  return null;
}

export async function buildGuardianProfile(
  supabase: SupabaseClient,
  baseProfile: Omit<UserProfileVM, 'kind'>,
  profileRow: ProfileRow,
): Promise<GuardianProfileVM> {
  const guardian = await getGuardianProfile(supabase, profileRow.id);
  const familyLinks = await getGuardianFamilyLinks(
    supabase,
    profileRow.org_id,
    profileRow.account_id,
  );

  const childAccountIds =
    familyLinks.data?.map((link) => link.child_account_id) ?? [];
  const children = await loadChildProfiles(
    supabase,
    profileRow.org_id,
    childAccountIds,
  );

  const childrenConnection: ConnectionVM<ChildProfileVM> = {
    items: children,
    total: children.length,
  };

  return {
    ...baseProfile,
    kind: 'guardian',
    children: childrenConnection,
    joinedDate: guardian.data?.joined_date ?? profileRow.created_at,
    sessionNotesVisibility: normalizeSessionNotesVisibility(
      guardian.data?.session_notes_visibility,
    ),
  };
}
