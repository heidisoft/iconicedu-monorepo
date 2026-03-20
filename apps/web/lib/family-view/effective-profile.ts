import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  clearFamilyViewCookie,
  getFamilyViewCookieSelection,
} from '@iconicedu/web/lib/family-view/context';
import { getGuardianFamilyLinks } from '@iconicedu/web/lib/profile/queries/guardian.query';
import {
  getChildProfilesByAccountIds,
  getProfilesByAccountId,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { resolveActiveProfileForAccountInOrg } from '@iconicedu/web/lib/profile/queries/active-profile.query';

export type FamilySwitchOption = {
  profileId: string;
  kind: 'guardian' | 'child';
  label: string;
  displayName?: string | null;
  isParentOption?: boolean;
};

export type EffectiveProfileResolution = {
  account: AccountRow;
  effectiveProfile: ProfileRow;
  activeProfile: ProfileRow;
  guardianProfile: ProfileRow | null;
  linkedChildProfiles: ProfileRow[];
  familySwitchOptions: FamilySwitchOption[];
  isViewingAsChild: boolean;
  viewingAsProfileId: string | null;
};

function toSwitchLabel(kind: 'guardian' | 'child'): string {
  return kind === 'guardian' ? 'Parent' : 'Student';
}

export async function resolveEffectiveProfileForAccountInOrg(
  supabase: SupabaseClient,
  input: {
    account: AccountRow;
    authUserId: string;
  },
): Promise<EffectiveProfileResolution> {
  const activeProfileResolution = await resolveActiveProfileForAccountInOrg(supabase, {
    accountId: input.account.id,
    orgId: input.account.org_id,
    activeProfileId: input.account.active_profile_id ?? null,
    updatedByAuthUserId: input.authUserId,
  });
  const activeProfile = activeProfileResolution.profile;

  const accountProfilesResponse = await getProfilesByAccountId(
    supabase,
    input.account.id,
  );
  if (accountProfilesResponse.error) {
    throw new Error(accountProfilesResponse.error.message);
  }

  const guardianProfile =
    activeProfile.kind === 'guardian'
      ? activeProfile
      : ((accountProfilesResponse.data ?? []).find((row) => row.kind === 'guardian') ??
        null);

  if (!guardianProfile) {
    return {
      account: input.account,
      effectiveProfile: activeProfile,
      activeProfile,
      guardianProfile: null,
      linkedChildProfiles: [],
      familySwitchOptions: [],
      isViewingAsChild: false,
      viewingAsProfileId: null,
    };
  }

  const familyLinksResponse = await getGuardianFamilyLinks(
    supabase,
    input.account.org_id,
    guardianProfile.account_id,
  );
  if (familyLinksResponse.error) {
    throw new Error(familyLinksResponse.error.message);
  }

  const linkedChildAccountIds = Array.from(
    new Set(
      (familyLinksResponse.data ?? [])
        .map((link) => link.child_account_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const linkedChildrenResponse = await getChildProfilesByAccountIds(
    supabase,
    input.account.org_id,
    linkedChildAccountIds,
  );
  if (linkedChildrenResponse.error) {
    throw new Error(linkedChildrenResponse.error.message);
  }
  const linkedChildProfiles = (linkedChildrenResponse.data ?? []).filter(
    (profile) => profile.kind === 'child' && profile.status !== 'deleted',
  );
  const linkedChildById = new Map(
    linkedChildProfiles.map((profile) => [profile.id, profile]),
  );

  const familySelection = await getFamilyViewCookieSelection();
  const hasCookieSelection = Boolean(familySelection);

  const selectedChildProfile =
    familySelection &&
    familySelection.orgId === input.account.org_id &&
    familySelection.guardianAccountId === guardianProfile.account_id
      ? (linkedChildById.get(familySelection.childProfileId) ?? null)
      : null;

  let effectiveProfile = activeProfile;
  let isViewingAsChild = false;
  let viewingAsProfileId: string | null = null;

  if (selectedChildProfile) {
    effectiveProfile = selectedChildProfile;
    isViewingAsChild = true;
    viewingAsProfileId = selectedChildProfile.id;
  } else if (hasCookieSelection) {
    await clearFamilyViewCookie();
  }

  const familySwitchOptions: FamilySwitchOption[] = [
    {
      profileId: guardianProfile.id,
      kind: 'guardian',
      label: toSwitchLabel('guardian'),
      displayName: guardianProfile.display_name ?? null,
      isParentOption: true,
    },
    ...linkedChildProfiles.map((profile) => ({
      profileId: profile.id,
      kind: 'child' as const,
      label: toSwitchLabel('child'),
      displayName: profile.display_name ?? null,
      isParentOption: false,
    })),
  ];

  return {
    account: input.account,
    effectiveProfile,
    activeProfile,
    guardianProfile,
    linkedChildProfiles,
    familySwitchOptions,
    isViewingAsChild,
    viewingAsProfileId,
  };
}

export async function resolveEffectiveProfileForAuthUserInOrg(
  supabase: SupabaseClient,
  input: {
    authUserId: string;
    orgId: string;
  },
): Promise<EffectiveProfileResolution> {
  const accountResponse = await getAccountByAuthUserIdInOrg(
    supabase,
    input.authUserId,
    input.orgId,
  );
  if (!accountResponse.data) {
    throw new Error('Account not found for organization.');
  }
  return resolveEffectiveProfileForAccountInOrg(supabase, {
    account: accountResponse.data,
    authUserId: input.authUserId,
  });
}
