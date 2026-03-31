import type { UserAccountVM, UserProfileVM } from '@iconicedu/shared-types';

import { buildAccountById } from '@iconicedu/web/lib/accounts/builders/account.builder';
import { getAccountById } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
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

  const authContext = await requireAdminOrgContext(accountRow.org_id, {
    allowStaff: true,
  });
  if (!authContext.ok) {
    throw new Error(authContext.message);
  }

  const [account, profile] = await Promise.all([
    buildAccountById(
      supabase,
      normalizedAccountId,
      accountRow.org_id,
      accountRow.email ?? null,
    ),
    buildUserProfileByAccountId(supabase, normalizedAccountId, {
      accountEmail: accountRow.email ?? null,
      includeFamilyInvites: true,
    }),
  ]);

  return {
    account,
    profile,
    metadata: buildAdminUserProfilePreviewMetadata(account, profile),
  };
}
