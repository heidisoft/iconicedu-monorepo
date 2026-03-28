import type { UserAccountVM, UserProfileVM } from '@iconicedu/shared-types';

import { buildAccountById } from '@iconicedu/web/lib/accounts/builders/account.builder';
import { getAccountById } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { buildUserProfileByAccountId } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export type AdminUserProfilePreview = {
  account: UserAccountVM | null;
  profile: UserProfileVM | null;
};

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
  };
}
