import type { FamilyLinkInviteVM } from '@iconicedu/shared-types';

type FamilyMemberLite = {
  email?: string;
  hasAuthAccount?: boolean;
  isChild?: boolean;
};

function normalizeEmail(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

export function formatChildName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string,
): string {
  const first = firstName?.trim() ?? '';
  const lastInitial = lastName?.trim().charAt(0).toUpperCase() ?? '';

  if (first) {
    return lastInitial ? `${first} ${lastInitial}` : first;
  }

  return fallback ?? '';
}

export function dedupeChildMembersByEmail<T extends FamilyMemberLite>(members: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  members.forEach((member) => {
    if (!member.isChild) {
      result.push(member);
      return;
    }

    const key = normalizeEmail(member.email);
    if (!key) {
      result.push(member);
      return;
    }

    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(member);
  });

  return result;
}

export function filterInvitesWithExistingAccounts<T extends FamilyMemberLite>(
  invites: FamilyLinkInviteVM[],
  members: T[],
): FamilyLinkInviteVM[] {
  const existingAccountEmails = new Set(
    members
      .filter((member) => member.isChild)
      .map((member) => normalizeEmail(member.email))
      .filter(Boolean),
  );

  return invites.filter((invite) => {
    const inviteEmail = normalizeEmail(invite.invitedEmail ?? undefined);
    if (!inviteEmail) {
      return true;
    }
    return !existingAccountEmails.has(inviteEmail);
  });
}
