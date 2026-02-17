import type {
  AccountRow,
  FamilyLinkInviteRow,
  FamilyLinkRow,
  ProfileRow,
} from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { getAccountsByIds } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getFamiliesByOrg,
  getFamilyInvitesByFamilyIds,
  getFamilyLinksByFamilyIds,
} from '@iconicedu/web/lib/family/queries/families.query';
import { getProfilesByAccountIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

export type AdminFamilyParticipant = {
  id: string;
  label: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatarSource?: string | null;
  themeKey?: string | null;
};

export type AdminFamilyInviteSummary = {
  id: string;
  invitedEmail?: string | null;
  invitedPhone?: string | null;
  invitedRole: FamilyLinkInviteRow['invited_role'];
  status: FamilyLinkInviteRow['status'];
  createdAt: string;
};

export type AdminFamilyRow = {
  familyId: string;
  displayName: string;
  guardians: AdminFamilyParticipant[];
  children: AdminFamilyParticipant[];
  pendingInvites: AdminFamilyInviteSummary[];
  familyLinkCount: number;
  createdAt: string;
  updatedAt: string;
};

function getProfileName(profile?: ProfileRow | null) {
  if (!profile) {
    return null;
  }
  const displayName = profile.display_name?.trim();
  if (displayName) {
    return displayName;
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

function formatChildLabel(accountId: string, account?: AccountRow, profile?: ProfileRow | null) {
  const profileName = getProfileName(profile);
  if (profileName) {
    return profileName;
  }
  const email = account?.email?.trim();
  if (email) {
    return `Draft (${email})`;
  }
  return `Draft account ${accountId.slice(0, 8)}`;
}

function buildGuardianParticipant(
  accountId: string,
  account?: AccountRow,
  profile?: ProfileRow | null,
): AdminFamilyParticipant {
  const profileName = getProfileName(profile);
  const email = account?.email?.trim();
  const name = profileName || `Account ${accountId.slice(0, 8)}`;
  const label = email ? `${name} (${email})` : name;

  return {
    id: accountId,
    label,
    name,
    email: email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    avatarSource: profile?.avatar_source ?? null,
    themeKey: profile?.ui_theme_key ?? null,
  };
}

export async function getAdminFamilyRows(): Promise<AdminFamilyRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: families } = await getFamiliesByOrg(supabase, ORG_ID);

  if (!families?.length) {
    return [];
  }

  const familyIds = families.map((family) => family.id);

  const { data: links } = await getFamilyLinksByFamilyIds(
    supabase,
    ORG_ID,
    familyIds,
  );

  const accountIds = new Set<string>();
  links?.forEach((link) => {
    accountIds.add(link.guardian_account_id);
    accountIds.add(link.child_account_id);
  });

  const accounts =
    accountIds.size > 0
      ? await getAccountsByIds(supabase, ORG_ID, Array.from(accountIds))
      : { data: [] as AccountRow[] };

  const accountMap = new Map<string, AccountRow>();
  accounts.data?.forEach((account) => accountMap.set(account.id, account));

  const { data: profiles } =
    accountIds.size > 0
      ? await getProfilesByAccountIds(supabase, ORG_ID, Array.from(accountIds))
      : { data: [] as ProfileRow[] };
  const guardianProfileByAccountId = new Map<string, ProfileRow>();
  const childProfileByAccountId = new Map<string, ProfileRow>();
  profiles?.forEach((profile) => {
    if (profile.kind === 'guardian' && !guardianProfileByAccountId.has(profile.account_id)) {
      guardianProfileByAccountId.set(profile.account_id, profile);
      return;
    }
    if (profile.kind !== 'child' || childProfileByAccountId.has(profile.account_id)) {
      return;
    }
    childProfileByAccountId.set(profile.account_id, profile);
  });

  const { data: invites } = await getFamilyInvitesByFamilyIds(
    supabase,
    ORG_ID,
    familyIds,
  );

  const invitesByFamily = new Map<string, FamilyLinkInviteRow[]>();
  invites?.forEach((invite) => {
    const existing = invitesByFamily.get(invite.family_id) ?? [];
    existing.push(invite);
    invitesByFamily.set(invite.family_id, existing);
  });

  const linksByFamily = new Map<string, FamilyLinkRow[]>();
  links?.forEach((link) => {
    const existing = linksByFamily.get(link.family_id) ?? [];
    existing.push(link);
    linksByFamily.set(link.family_id, existing);
  });

  return families.map((family) => {
    const familyLinks = linksByFamily.get(family.id) ?? [];

    const guardianMap = new Map<string, AdminFamilyParticipant>();
    const childMap = new Map<string, AdminFamilyParticipant>();

    familyLinks.forEach((link) => {
      guardianMap.set(
        link.guardian_account_id,
        buildGuardianParticipant(
          link.guardian_account_id,
          accountMap.get(link.guardian_account_id),
          guardianProfileByAccountId.get(link.guardian_account_id),
        ),
      );
      childMap.set(link.child_account_id, {
        id: link.child_account_id,
        label: formatChildLabel(
          link.child_account_id,
          accountMap.get(link.child_account_id),
          childProfileByAccountId.get(link.child_account_id),
        ),
        avatarUrl: childProfileByAccountId.get(link.child_account_id)?.avatar_url ?? null,
        avatarSource:
          childProfileByAccountId.get(link.child_account_id)?.avatar_source ?? null,
        themeKey: childProfileByAccountId.get(link.child_account_id)?.ui_theme_key ?? null,
      });
    });

    const pendingInvites = (invitesByFamily.get(family.id) ?? []).map((invite) => ({
      id: invite.id,
      invitedEmail: invite.invited_email,
      invitedPhone: invite.invited_phone_e164,
      invitedRole: invite.invited_role,
      status: invite.status,
      createdAt: invite.created_at,
    }));

    return {
      familyId: family.id,
      displayName: family.display_name,
      guardians: Array.from(guardianMap.values()),
      children: Array.from(childMap.values()),
      pendingInvites,
      familyLinkCount: familyLinks.length,
      createdAt: family.created_at,
      updatedAt: family.updated_at ?? family.created_at,
    };
  });
}
