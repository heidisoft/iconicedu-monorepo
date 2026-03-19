import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { getAccountsByOrgId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileSummariesByAccountIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export type AdminUserRow = {
  id: string;
  orgId: string;
  email?: string | null;
  phone?: string | null;
  status: 'active' | 'invited' | 'archived' | string;
  createdAt: string;
  lastSignInAt: string;
  profileId?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileKind?: string | null;
  avatarUrl?: string | null;
  avatarSource?: string | null;
  themeKey?: string | null;
  countryName?: string | null;
  timezone?: string | null;
  primaryRole?: AccountRow['primary_role'] | null;
  roleStatus?: AccountRow['role_status'] | null;
};

function mapAccountToRow(account: AccountRow, profile?: ProfileRow | null): AdminUserRow {
  const normalizedStatus = account.status?.toLowerCase() ?? '';
  const status =
    normalizedStatus === 'deleted'
      ? 'archived'
      : normalizedStatus === 'invited'
        ? 'invited'
        : 'active';
  const profileKind = profile?.kind ?? null;
  const displayName = profile?.display_name?.trim() ?? '';
  const first = profile?.first_name?.trim() ?? '';
  const last = profile?.last_name?.trim() ?? '';
  const profileName =
    displayName ||
    (first && last ? `${first} ${last.charAt(0).toUpperCase()}.` : first || null);
  return {
    id: account.id,
    orgId: account.org_id,
    email: account.email,
    phone: account.phone_e164 ?? null,
    status,
    createdAt: account.created_at,
    lastSignInAt: account.updated_at,
    profileId: profile?.id ?? null,
    displayName: profileName ?? account.email,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    profileKind,
    avatarUrl: profile?.avatar_url ?? null,
    avatarSource: profile?.avatar_source ?? null,
    themeKey: profile?.ui_theme_key ?? null,
    countryName: profile?.country_name ?? null,
    timezone: profile?.timezone ?? null,
    primaryRole: account.primary_role ?? null,
    roleStatus: account.role_status ?? null,
  };
}

export async function getAdminUserRows(orgId: string): Promise<AdminUserRow[]> {
  if (!orgId) {
    return [];
  }

  const authContext = await requireAdminOrgContext(orgId, { allowStaff: true });
  if (!authContext.ok) {
    throw new Error(authContext.message);
  }

  const supabase = createSupabaseServiceClient();
  const { data: accounts } = await getAccountsByOrgId(supabase, orgId);

  if (!accounts?.length) {
    return [];
  }

  const sortedAccounts = [...accounts].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const accountIds = sortedAccounts.map((account) => account.id);
  const { data: profiles } = await getProfileSummariesByAccountIds(
    supabase,
    orgId,
    accountIds,
  );

  const profileByAccountId = new Map<string, ProfileRow>();
  profiles?.forEach((profile) => {
    if (!profile.account_id || profileByAccountId.has(profile.account_id)) {
      return;
    }
    profileByAccountId.set(profile.account_id, profile);
  });

  return sortedAccounts.map((account) =>
    mapAccountToRow(account, profileByAccountId.get(account.id) ?? null),
  );
}
