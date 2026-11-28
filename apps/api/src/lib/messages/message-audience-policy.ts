import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import {
  canAddressPrivately,
  canInitiateRestrictedMessage,
  requiresGuardianForStudentRecipients,
  resolveMessageAudienceRole,
  type MessageAudienceRole,
} from '@iconicedu/utils';
import type { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

const STAFF_ROLE_KEYS = ['owner', 'admin', 'staff'];

const ROLE_LABELS: Record<MessageAudienceRole, string> = {
  staff: 'staff',
  tutor: 'tutors',
  parent: 'parents',
  student: 'students',
  other: 'this member',
};

export type AudienceProfileRole = {
  accountId: string;
  role: MessageAudienceRole;
};

function assertNoError(response: { error: { message: string } | null }) {
  if (response.error) {
    throw new InternalServerErrorException(response.error.message);
  }
}

/**
 * Resolves safeguarding roles for org profiles. Owners, admins, and staff
 * (by role grant, primary role, or staff profile) all resolve to `staff`.
 */
export async function loadMessageAudienceRoles(
  serviceSupabase: ServiceClient,
  orgId: string,
  profileIds: string[],
): Promise<Map<string, AudienceProfileRole>> {
  const uniqueIds = Array.from(new Set(profileIds));
  if (!uniqueIds.length) return new Map();

  const profilesResponse = await serviceSupabase
    .from('profiles')
    .select('id, account_id, kind')
    .eq('org_id', orgId)
    .in('id', uniqueIds)
    .is('deleted_at', null)
    .returns<Array<{ id: string; account_id: string | null; kind: string | null }>>();
  assertNoError(profilesResponse);
  const profiles = profilesResponse.data ?? [];
  const accountIds = Array.from(
    new Set(profiles.map((profile) => profile.account_id).filter(Boolean) as string[]),
  );

  const staffAccountIds = new Set<string>();
  if (accountIds.length) {
    const [roleGrantsResponse, primaryRolesResponse] = await Promise.all([
      serviceSupabase
        .from('user_roles')
        .select('account_id')
        .eq('org_id', orgId)
        .in('account_id', accountIds)
        .in('role_key', STAFF_ROLE_KEYS)
        .is('deleted_at', null)
        .returns<Array<{ account_id: string }>>(),
      serviceSupabase
        .from('accounts')
        .select('id')
        .eq('org_id', orgId)
        .in('id', accountIds)
        .in('primary_role', STAFF_ROLE_KEYS)
        .is('deleted_at', null)
        .returns<Array<{ id: string }>>(),
    ]);
    assertNoError(roleGrantsResponse);
    assertNoError(primaryRolesResponse);
    for (const row of roleGrantsResponse.data ?? []) staffAccountIds.add(row.account_id);
    for (const row of primaryRolesResponse.data ?? []) staffAccountIds.add(row.id);
  }

  return new Map(
    profiles
      .filter((profile) => profile.account_id)
      .map((profile) => [
        profile.id,
        {
          accountId: profile.account_id as string,
          role: resolveMessageAudienceRole(profile.kind, {
            hasStaffRole: staffAccountIds.has(profile.account_id as string),
          }),
        },
      ]),
  );
}

/**
 * Guardian profiles that are active members of the channel, keyed by the
 * student profile they look after.
 */
async function loadChannelGuardiansForStudents(input: {
  serviceSupabase: ServiceClient;
  orgId: string;
  channelId: string;
  students: Array<{ profileId: string; accountId: string }>;
}): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(
    input.students.map((student) => [student.profileId, []]),
  );
  if (!input.students.length) return result;

  const linksResponse = await input.serviceSupabase
    .from('family_links')
    .select('guardian_account_id, child_account_id')
    .eq('org_id', input.orgId)
    .in(
      'child_account_id',
      input.students.map((student) => student.accountId),
    )
    .is('deleted_at', null)
    .returns<Array<{ guardian_account_id: string; child_account_id: string }>>();
  assertNoError(linksResponse);
  const links = linksResponse.data ?? [];
  if (!links.length) return result;

  const guardianProfilesResponse = await input.serviceSupabase
    .from('profiles')
    .select('id, account_id')
    .eq('org_id', input.orgId)
    .eq('kind', 'guardian')
    .in('account_id', Array.from(new Set(links.map((link) => link.guardian_account_id))))
    .is('deleted_at', null)
    .returns<Array<{ id: string; account_id: string }>>();
  assertNoError(guardianProfilesResponse);
  const guardianProfiles = guardianProfilesResponse.data ?? [];
  if (!guardianProfiles.length) return result;

  const membersResponse = await input.serviceSupabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .in(
      'profile_id',
      guardianProfiles.map((profile) => profile.id),
    )
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();
  assertNoError(membersResponse);
  const memberIds = new Set((membersResponse.data ?? []).map((row) => row.profile_id));

  for (const student of input.students) {
    const guardianAccounts = new Set(
      links
        .filter((link) => link.child_account_id === student.accountId)
        .map((link) => link.guardian_account_id),
    );
    result.set(
      student.profileId,
      guardianProfiles
        .filter(
          (profile) =>
            guardianAccounts.has(profile.account_id) && memberIds.has(profile.id),
        )
        .map((profile) => profile.id),
    );
  }
  return result;
}

/**
 * Applies the safeguarding rules to an explicit audience (already validated as
 * channel members) and returns the final audience, including the sender and
 * any guardians that must accompany a student.
 */
export async function enforceMessageAudiencePolicy(input: {
  serviceSupabase: ServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  requestedProfileIds: string[];
}): Promise<string[]> {
  const recipientIds = input.requestedProfileIds.filter(
    (id) => id !== input.senderProfileId,
  );
  const roles = await loadMessageAudienceRoles(input.serviceSupabase, input.orgId, [
    input.senderProfileId,
    ...recipientIds,
  ]);
  const senderRole = roles.get(input.senderProfileId)?.role ?? 'other';

  if (!canInitiateRestrictedMessage(senderRole)) {
    throw new ForbiddenException(
      senderRole === 'student'
        ? 'Students can only send messages to everyone in the channel'
        : 'You cannot send private messages in this channel',
    );
  }

  const students: Array<{ profileId: string; accountId: string }> = [];
  for (const recipientId of recipientIds) {
    const recipient = roles.get(recipientId);
    const recipientRole = recipient?.role ?? 'other';
    if (!canAddressPrivately(senderRole, recipientRole)) {
      throw new ForbiddenException(
        `You cannot send private messages to ${ROLE_LABELS[recipientRole]}`,
      );
    }
    if (recipient && recipientRole === 'student') {
      students.push({ profileId: recipientId, accountId: recipient.accountId });
    }
  }

  const guardiansByStudent = await loadChannelGuardiansForStudents({
    serviceSupabase: input.serviceSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
    students,
  });
  if (requiresGuardianForStudentRecipients(senderRole)) {
    const unaccompanied = students.some(
      (student) => !(guardiansByStudent.get(student.profileId) ?? []).length,
    );
    if (unaccompanied) {
      throw new ForbiddenException(
        'Students can only be messaged privately together with a parent in this channel',
      );
    }
  }

  return Array.from(
    new Set([
      input.senderProfileId,
      ...recipientIds,
      ...Array.from(guardiansByStudent.values()).flat(),
    ]),
  );
}

/** Staff (incl. owners and admins) may review restricted messages read-only. */
export async function isMessageAudienceReviewer(input: {
  serviceSupabase: ServiceClient;
  orgId: string;
  profileId: string;
}): Promise<boolean> {
  const roles = await loadMessageAudienceRoles(input.serviceSupabase, input.orgId, [
    input.profileId,
  ]);
  return roles.get(input.profileId)?.role === 'staff';
}
