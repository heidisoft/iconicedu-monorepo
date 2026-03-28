import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { getAccountsByOrgId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getFamilyLinksByOrg } from '@iconicedu/web/lib/family/queries/families.query';
import { getProfileSummariesByAccountIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getPresenceByProfileIds } from '@iconicedu/web/lib/profile/queries/presence.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export type AdminUserRow = {
  id: string;
  orgId: string;
  email?: string | null;
  phone?: string | null;
  status: 'active' | 'invited' | 'archived' | string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string | null;
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
  linkedChildAccountIds?: string[];
  linkedGuardianAccountIds?: string[];
};

function mapAccountToRow(
  account: AccountRow,
  profile?: ProfileRow | null,
  presence?: { lastSeenAt?: string | null } | null,
  relationships?: {
    linkedChildAccountIds?: string[];
    linkedGuardianAccountIds?: string[];
  },
): AdminUserRow {
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
    updatedAt: account.updated_at,
    lastSeenAt: presence?.lastSeenAt ?? null,
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
    linkedChildAccountIds: relationships?.linkedChildAccountIds ?? [],
    linkedGuardianAccountIds: relationships?.linkedGuardianAccountIds ?? [],
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
    b.updated_at.localeCompare(a.updated_at),
  );
  const accountIds = sortedAccounts.map((account) => account.id);
  const { data: profiles } = await getProfileSummariesByAccountIds(
    supabase,
    orgId,
    accountIds,
  );
  const { data: familyLinks } = await getFamilyLinksByOrg(supabase, orgId);

  const profileByAccountId = new Map<string, ProfileRow>();
  profiles?.forEach((profile) => {
    if (!profile.account_id || profileByAccountId.has(profile.account_id)) {
      return;
    }
    profileByAccountId.set(profile.account_id, profile);
  });

  const profileIds =
    profiles
      ?.map((profile) => profile.id)
      .filter((profileId): profileId is string => Boolean(profileId)) ?? [];
  const { data: presenceRows } = await getPresenceByProfileIds(
    supabase,
    orgId,
    profileIds,
  );
  const lastSeenByProfileId = new Map<string, string | null>();
  presenceRows?.forEach((presenceRow) => {
    lastSeenByProfileId.set(presenceRow.profile_id, presenceRow.last_seen_at ?? null);
  });

  const linkedChildAccountIdsByGuardianId = new Map<string, Set<string>>();
  const linkedGuardianAccountIdsByChildId = new Map<string, Set<string>>();

  familyLinks?.forEach((link) => {
    const guardianChildren =
      linkedChildAccountIdsByGuardianId.get(link.guardian_account_id) ??
      new Set<string>();
    guardianChildren.add(link.child_account_id);
    linkedChildAccountIdsByGuardianId.set(link.guardian_account_id, guardianChildren);

    const childGuardians =
      linkedGuardianAccountIdsByChildId.get(link.child_account_id) ?? new Set<string>();
    childGuardians.add(link.guardian_account_id);
    linkedGuardianAccountIdsByChildId.set(link.child_account_id, childGuardians);
  });

  return sortedAccounts.map((account) => {
    const profile = profileByAccountId.get(account.id) ?? null;

    return mapAccountToRow(
      account,
      profile,
      profile?.id ? { lastSeenAt: lastSeenByProfileId.get(profile.id) ?? null } : null,
      {
        linkedChildAccountIds: Array.from(
          linkedChildAccountIdsByGuardianId.get(account.id) ?? [],
        ),
        linkedGuardianAccountIds: Array.from(
          linkedGuardianAccountIdsByChildId.get(account.id) ?? [],
        ),
      },
    );
  });
}
