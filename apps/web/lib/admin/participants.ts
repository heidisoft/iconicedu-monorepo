import type { UserProfileVM, ProfileRow } from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { mapBaseProfile } from '@iconicedu/web/lib/profile/mappers/base-profile.mapper';
import { getAccountsByOrgId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getProfilesByAccountIds,
  getProfilesByKind,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getFamilyLinksByOrg } from '@iconicedu/web/lib/family/queries/families.query';

type GuardianNameMap = Map<string, string[]>;

function getDisplayName(profile: ProfileRow) {
  const name = profile.display_name?.trim();
  if (name) {
    return name;
  }
  const first = profile.first_name?.trim() ?? '';
  const last = profile.last_name?.trim() ?? '';
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) {
    return first;
  }
  return null;
}

function mapProfileToUserProfile(
  profile: ProfileRow,
  accountEmail: string | null,
  guardianNames: string[] | null,
): UserProfileVM {
  const base = mapBaseProfile(profile, {
    notificationDefaults: null,
    notificationScopedDefaults: null,
    presence: null,
    accountEmail,
  });

  switch (profile.kind) {
    case 'guardian':
      return {
        ...base,
        kind: 'guardian',
        joinedDate: profile.created_at,
      };
    case 'educator':
      return {
        ...base,
        kind: 'educator',
        joinedDate: profile.created_at,
      };
    case 'child':
      return {
        ...base,
        kind: 'child',
        guardianNames,
      };
    case 'staff':
      return {
        ...base,
        kind: 'staff',
      };
    case 'system':
      return {
        ...base,
        kind: 'system',
      };
    default:
      return {
        ...base,
        kind: 'staff',
      };
  }
}

export async function getActiveParticipantProfiles(
  orgId: string,
): Promise<UserProfileVM[]> {
  if (!orgId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await getAccountsByOrgId(supabase, orgId, {
    status: 'active',
  });

  if (!accounts?.length) {
    return [];
  }

  const accountIds = accounts.map((account) => account.id);
  const [{ data: profiles }, { data: guardianProfiles }, { data: familyLinks }] =
    await Promise.all([
      getProfilesByAccountIds(supabase, orgId, accountIds),
      getProfilesByKind(supabase, orgId, 'guardian'),
      getFamilyLinksByOrg(supabase, orgId),
    ]);

  const guardianNameByAccountId: GuardianNameMap = new Map();
  (guardianProfiles ?? []).forEach((profile: ProfileRow) => {
    const name = getDisplayName(profile);
    if (!name) return;
    const existing = guardianNameByAccountId.get(profile.account_id) ?? [];
    guardianNameByAccountId.set(profile.account_id, [...existing, name]);
  });

  const guardianNamesByChildAccountId: GuardianNameMap = new Map();
  (familyLinks ?? []).forEach((link) => {
    const guardianNames = guardianNameByAccountId.get(link.guardian_account_id);
    if (!guardianNames?.length) return;
    const existing = guardianNamesByChildAccountId.get(link.child_account_id) ?? [];
    guardianNamesByChildAccountId.set(link.child_account_id, [
      ...existing,
      ...guardianNames,
    ]);
  });

  const profilesByAccountId = new Map<string, ProfileRow[]>();
  (profiles ?? []).forEach((profile) => {
    const existing = profilesByAccountId.get(profile.account_id) ?? [];
    profilesByAccountId.set(profile.account_id, [...existing, profile]);
  });

  return accounts.flatMap((account) =>
    (profilesByAccountId.get(account.id) ?? []).map((profile) =>
      mapProfileToUserProfile(
        profile,
        account.email ?? null,
        profile.kind === 'child'
          ? (guardianNamesByChildAccountId.get(profile.account_id) ?? null)
          : null,
      ),
    ),
  );
}
