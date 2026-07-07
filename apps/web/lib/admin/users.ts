import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';

import {
  requireAdminOrgContext,
  throwAdminOrgContextError,
} from '@iconicedu/web/lib/admin/require-admin-org-context';
import { getAccountsByOrgId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getFamilyLinksByOrg } from '@iconicedu/web/lib/family/queries/families.query';
import {
  getProfileSummariesByAccountIds,
  getProfileNamesByAccountIds,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
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
  linkedGuardianNames?: string[];
};

function mapAccountToRow(
  account: AccountRow,
  profile?: ProfileRow | null,
  presence?: { lastSeenAt?: string | null } | null,
  relationships?: {
    linkedChildAccountIds?: string[];
    linkedGuardianAccountIds?: string[];
    linkedGuardianNames?: string[];
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
    linkedGuardianNames: relationships?.linkedGuardianNames ?? [],
  };
}

export async function getAdminUserRows(orgId: string): Promise<AdminUserRow[]> {
  if (!orgId) {
    return [];
  }

  const authContext = await requireAdminOrgContext(orgId, { allowStaff: true });
  throwAdminOrgContextError(authContext);

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

export type AdminUserRowsPage = {
  rows: AdminUserRow[];
  total: number;
  pageCount: number;
};

export async function getAdminUserRowsPaginated(
  orgId: string,
  options: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    role?: string;
    sortBy?: 'recently_active' | 'created';
  },
): Promise<AdminUserRowsPage> {
  if (!orgId) return { rows: [], total: 0, pageCount: 1 };

  const authContext = await requireAdminOrgContext(orgId, { allowStaff: true });
  throwAdminOrgContextError(authContext);

  const supabase = createSupabaseServiceClient();

  // Phase 1 — lightweight: all accounts + family links + minimal profile names for search/grouping
  const [accountsResult, familyLinksResult] = await Promise.all([
    getAccountsByOrgId(supabase, orgId),
    getFamilyLinksByOrg(supabase, orgId),
  ]);

  const allAccounts = accountsResult.data ?? [];
  const familyLinks = familyLinksResult.data ?? [];

  // Build family relationship maps
  const linkedChildAccountIdsByGuardianId = new Map<string, Set<string>>();
  const linkedGuardianAccountIdsByChildId = new Map<string, Set<string>>();
  familyLinks.forEach((link) => {
    const children =
      linkedChildAccountIdsByGuardianId.get(link.guardian_account_id) ??
      new Set<string>();
    children.add(link.child_account_id);
    linkedChildAccountIdsByGuardianId.set(link.guardian_account_id, children);
    const guardians =
      linkedGuardianAccountIdsByChildId.get(link.child_account_id) ?? new Set<string>();
    guardians.add(link.guardian_account_id);
    linkedGuardianAccountIdsByChildId.set(link.child_account_id, guardians);
  });

  // Get minimal profile names for all accounts (for search by name / profileKind grouping)
  const allAccountIds = allAccounts.map((a) => a.id);
  const { data: nameRows } = await getProfileNamesByAccountIds(
    supabase,
    orgId,
    allAccountIds,
  );
  type NameRow = {
    id: string | null;
    account_id: string | null;
    kind: string | null;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  const nameByAccountId = new Map<string, NameRow>();
  (nameRows as NameRow[] | null)?.forEach((r) => {
    if (r.account_id && !nameByAccountId.has(r.account_id)) {
      nameByAccountId.set(r.account_id, r);
    }
  });

  // Helper: resolve display name from name row
  const resolveName = (accountId: string, email?: string | null): string => {
    const n = nameByAccountId.get(accountId);
    if (!n) return email ?? 'Unnamed';
    const first = n.first_name?.trim() ?? '';
    const last = n.last_name?.trim() ?? '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    return n.display_name?.trim() || full || email || 'Unnamed';
  };

  // Apply status filter + search filter at account level
  const {
    page,
    pageSize,
    search = '',
    status = 'all',
    role = 'all',
    sortBy = 'recently_active',
  } = options;
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = allAccounts.filter((account) => {
    const normalizedStatus =
      account.status?.toLowerCase() === 'deleted'
        ? 'archived'
        : account.status?.toLowerCase() === 'invited'
          ? 'invited'
          : 'active';
    if (status !== 'all' && normalizedStatus !== status) return false;
    if (role !== 'all') {
      const kind = nameByAccountId.get(account.id)?.kind?.toLowerCase() ?? '';
      if (kind !== role.toLowerCase()) return false;
    }
    if (!normalizedSearch) return true;
    const name = resolveName(account.id, account.email).toLowerCase();
    const kind = nameByAccountId.get(account.id)?.kind?.toLowerCase() ?? '';
    return (
      name.includes(normalizedSearch) ||
      (account.email?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (account.phone_e164?.toLowerCase().includes(normalizedSearch) ?? false) ||
      kind.includes(normalizedSearch)
    );
  });

  // Sort
  if (sortBy === 'created') {
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else {
    // "recently_active": sort by presence last_seen_at desc (null → end).
    // Load presence for all filtered accounts before paginating so the sort is correct.
    const filteredProfileIds = filtered
      .map((a) => nameByAccountId.get(a.id)?.id)
      .filter((id): id is string => Boolean(id));
    const { data: allPresenceRows } = filteredProfileIds.length
      ? await getPresenceByProfileIds(supabase, orgId, filteredProfileIds)
      : { data: [] };
    const lastSeenByProfileIdEarly = new Map<string, string>(
      (allPresenceRows ?? [])
        .filter((r) => r.last_seen_at)
        .map((r) => [r.profile_id, r.last_seen_at!]),
    );
    const getLastSeen = (accountId: string): string | null => {
      const profileId = nameByAccountId.get(accountId)?.id ?? null;
      return profileId ? (lastSeenByProfileIdEarly.get(profileId) ?? null) : null;
    };
    filtered.sort((a, b) => {
      const la = getLastSeen(a.id);
      const lb = getLastSeen(b.id);
      if (la && lb) return lb.localeCompare(la);
      if (la) return -1;
      if (lb) return 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageAccounts = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (pageAccounts.length === 0) return { rows: [], total, pageCount };

  // Phase 2 — heavy: full profiles + presence for only this page's accounts
  const pageAccountIdArr = pageAccounts.map((a) => a.id);
  const { data: profiles } = await getProfileSummariesByAccountIds(
    supabase,
    orgId,
    pageAccountIdArr,
  );

  const profileByAccountId = new Map<string, ProfileRow>();
  profiles?.forEach((p) => {
    if (p.account_id && !profileByAccountId.has(p.account_id)) {
      profileByAccountId.set(p.account_id, p);
    }
  });

  const profileIds = (profiles ?? [])
    .map((p) => p.id)
    .filter((id): id is string => Boolean(id));
  const { data: presenceRows } = await getPresenceByProfileIds(
    supabase,
    orgId,
    profileIds,
  );
  const lastSeenByProfileId = new Map<string, string | null>();
  presenceRows?.forEach((r) => {
    lastSeenByProfileId.set(r.profile_id, r.last_seen_at ?? null);
  });

  const rows: AdminUserRow[] = pageAccounts.map((account) => {
    const guardianAccountIds = Array.from(
      linkedGuardianAccountIdsByChildId.get(account.id) ?? [],
    );
    const guardianNames = guardianAccountIds
      .map((gid) => {
        const n = nameByAccountId.get(gid);
        if (!n) return null;
        const first = n.first_name?.trim() ?? '';
        const last = n.last_name?.trim() ?? '';
        const full = [first, last].filter(Boolean).join(' ').trim();
        return n.display_name?.trim() || full || null;
      })
      .filter((name): name is string => Boolean(name));

    return mapAccountToRow(
      account,
      profileByAccountId.get(account.id) ?? null,
      (() => {
        const profile = profileByAccountId.get(account.id);
        return profile?.id
          ? { lastSeenAt: lastSeenByProfileId.get(profile.id) ?? null }
          : null;
      })(),
      {
        linkedChildAccountIds: Array.from(
          linkedChildAccountIdsByGuardianId.get(account.id) ?? [],
        ),
        linkedGuardianAccountIds: guardianAccountIds,
        linkedGuardianNames: guardianNames,
      },
    );
  });

  return { rows, total, pageCount };
}
