import type { UserAccountVM, UserProfileVM } from '@iconicedu/shared-types';

import {
  mapAccountRowToVM,
  mapUserRoles,
} from '@iconicedu/web/lib/accounts/mappers/account.mapper';
import { getAccountById } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { buildUserProfileByAccountId } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export type AdminUserProfilePreviewMetadata = {
  accountId: string | null;
  accountOrgId: string | null;
  profileId: string | null;
  profileOrgId: string | null;
  profileAccountId: string | null;
  authUserId: string | null;
  managerStaffId: string | null;
  childProfileIds: string[];
  childAccountIds: string[];
  notificationScopeIds: string[];
  familyInviteIds: string[];
  familyInviteFamilyIds: string[];
  familyInviteAcceptedByAccountIds: string[];
  familyInviteCreatedByAccountIds: string[];
};

export type AdminUserProfilePreview = {
  account: UserAccountVM | null;
  profile: UserProfileVM | null;
  metadata: AdminUserProfilePreviewMetadata;
};

type GetAdminUserProfilePreviewOptions = {
  orgId?: string;
};

function dedupeIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim() ?? '').filter(Boolean)));
}

function buildAdminUserProfilePreviewMetadata(
  account: UserAccountVM | null,
  profile: UserProfileVM | null,
): AdminUserProfilePreviewMetadata {
  return {
    accountId: account?.ids.id ?? null,
    accountOrgId: account?.ids.orgId ?? null,
    profileId: profile?.ids.id ?? null,
    profileOrgId: profile?.ids.orgId ?? null,
    profileAccountId: profile?.ids.accountId ?? null,
    authUserId: profile?.kind === 'child' ? (profile.accountAuthUserId ?? null) : null,
    managerStaffId: profile?.kind === 'staff' ? (profile.managerStaffId ?? null) : null,
    childProfileIds:
      profile?.kind === 'guardian'
        ? dedupeIds(profile.children?.items?.map((child) => child.ids.id) ?? [])
        : [],
    childAccountIds:
      profile?.kind === 'guardian'
        ? dedupeIds(profile.children?.items?.map((child) => child.ids.accountId) ?? [])
        : [],
    notificationScopeIds: dedupeIds(
      profile?.prefs.notificationScopedDefaults?.map((item) => item.scopeId) ?? [],
    ),
    familyInviteIds:
      profile?.kind === 'guardian'
        ? dedupeIds(profile.familyInvites?.map((invite) => invite.id) ?? [])
        : [],
    familyInviteFamilyIds:
      profile?.kind === 'guardian'
        ? dedupeIds(profile.familyInvites?.map((invite) => invite.familyId) ?? [])
        : [],
    familyInviteAcceptedByAccountIds:
      profile?.kind === 'guardian'
        ? dedupeIds(
            profile.familyInvites?.map((invite) => invite.acceptedByAccountId) ?? [],
          )
        : [],
    familyInviteCreatedByAccountIds:
      profile?.kind === 'guardian'
        ? dedupeIds(
            profile.familyInvites?.map((invite) => invite.createdByAccountId) ?? [],
          )
        : [],
  };
}

export async function getAdminUserProfilePreview(
  accountId: string,
  options: GetAdminUserProfilePreviewOptions = {},
): Promise<AdminUserProfilePreview | null> {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const accountResponse = await getAccountById(supabase, normalizedAccountId);
  const accountRow = accountResponse.data;

  if (!accountRow) {
    return null;
  }

  if (options.orgId && accountRow.org_id !== options.orgId) {
    return null;
  }

  const authContext = await requireAdminOrgContext(accountRow.org_id, {
    allowStaff: true,
  });
  if (!authContext.ok) {
    throw new Error(authContext.message);
  }

  const [rolesResponse, profile] = await Promise.all([
    getUserRoles(supabase, normalizedAccountId, accountRow.org_id),
    buildUserProfileByAccountId(supabase, normalizedAccountId, {
      accountEmail: accountRow.email ?? null,
      includeFamilyInvites: true,
      includeNotificationPreferences: false,
    }),
  ]);
  const account = mapAccountRowToVM(accountRow, {
    accountId: normalizedAccountId,
    orgId: accountRow.org_id,
    authEmail: accountRow.email ?? null,
    userRoles: mapUserRoles(rolesResponse.data ?? []),
  });

  return {
    account,
    profile,
    metadata: buildAdminUserProfilePreviewMetadata(account, profile),
  };
}
