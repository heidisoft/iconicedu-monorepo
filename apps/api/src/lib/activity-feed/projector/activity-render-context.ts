import type { ActivityEventRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

export type ActivityRenderParticipantContext = {
  profileId: string;
  accountId?: string | null;
  name: string;
  kind?: string | null;
  role?: string | null;
};

export type ActivityRenderContext = {
  viewerProfileId: string;
  viewerRole?: string | null;
  viewerRoleKeys: string[];
  viewerIsAdminStaff: boolean;
  classTitle?: string;
  contextTitle?: string;
  teacherNames: string[];
  studentNames: string[];
  guardianNames: string[];
  viewerStudentNames: string[];
  participantNamesLabel?: string;
};

type ProfileSummary = Pick<
  ProfileRow,
  'id' | 'account_id' | 'kind' | 'display_name' | 'first_name' | 'last_name'
>;

type FamilyLinkSummary = {
  guardian_account_id: string;
  child_account_id: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildDisplayName(input: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const displayName = input.display_name?.trim();
  if (displayName) return displayName;

  const fullName = [input.first_name?.trim(), input.last_name?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();
  return fullName || 'Participant';
}

function formatNamesList(names: string[]) {
  const normalized = unique(names);
  if (!normalized.length) return undefined;
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized[0]}, ${normalized[1]} +${normalized.length - 2} more`;
}

function getLearningSpaceId(event: ActivityEventRow, payload: Record<string, unknown>) {
  const scope = asRecord(event.scope);
  return (
    asOptionalString(payload.learningSpaceId) ??
    (scope.kind === 'learning_space'
      ? asOptionalString(scope.learningSpaceId)
      : undefined)
  );
}

function getContextTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.title) ??
    asOptionalString(payload.learningSpaceTitle) ??
    asOptionalString(payload.channelTopic)
  );
}

function normalizePayloadMembers(value: unknown): ActivityRenderParticipantContext[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
    )
    .map((entry): ActivityRenderParticipantContext | null => {
      const profileId = asOptionalString(entry.profileId);
      const name =
        asOptionalString(entry.displayName) ??
        asOptionalString(entry.name) ??
        'Participant';
      if (!profileId) return null;
      return {
        profileId,
        name,
        role: asOptionalString(entry.role) ?? null,
        kind: asOptionalString(entry.kind) ?? null,
        accountId: asOptionalString(entry.accountId) ?? null,
      } satisfies ActivityRenderParticipantContext;
    })
    .filter((entry): entry is ActivityRenderParticipantContext => Boolean(entry));
}

async function loadLearningSpaceParticipants(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId?: string;
}) {
  if (!input.learningSpaceId) return [] as string[];

  const response = await input.supabase
    .from('learning_space_participants')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('learning_space_id', input.learningSpaceId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return unique((response.data ?? []).map((row) => row.profile_id));
}

async function loadProfiles(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  profileIds: string[];
}) {
  const profileIds = unique(input.profileIds);
  if (!profileIds.length) return [] as ProfileSummary[];

  const response = await input.supabase
    .from('profiles')
    .select('id, account_id, kind, display_name, first_name, last_name')
    .eq('org_id', input.orgId)
    .in('id', profileIds)
    .is('deleted_at', null)
    .returns<ProfileSummary[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? [];
}

async function loadProfilesByAccountIds(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  accountIds: string[];
}) {
  const accountIds = unique(input.accountIds);
  if (!accountIds.length) return [] as ProfileSummary[];

  const response = await input.supabase
    .from('profiles')
    .select('id, account_id, kind, display_name, first_name, last_name')
    .eq('org_id', input.orgId)
    .in('account_id', accountIds)
    .is('deleted_at', null)
    .returns<ProfileSummary[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? [];
}

async function loadFamilyLinks(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  childAccountIds: string[];
}) {
  const childAccountIds = unique(input.childAccountIds);
  if (!childAccountIds.length) return [] as FamilyLinkSummary[];

  const response = await input.supabase
    .from('family_links')
    .select('guardian_account_id, child_account_id')
    .eq('org_id', input.orgId)
    .in('child_account_id', childAccountIds)
    .is('deleted_at', null)
    .returns<FamilyLinkSummary[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? [];
}

async function loadRoleKeys(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  accountId?: string | null;
}) {
  if (!input.accountId) return [] as string[];

  const response = await input.supabase
    .from('user_roles')
    .select('role_key')
    .eq('org_id', input.orgId)
    .eq('account_id', input.accountId)
    .is('deleted_at', null)
    .returns<Array<{ role_key: string | null }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return unique(
    (response.data ?? [])
      .map((row) => row.role_key)
      .filter((value): value is string => Boolean(value)),
  );
}

function mergeParticipants(input: {
  payloadParticipants: ActivityRenderParticipantContext[];
  profiles: ProfileSummary[];
}) {
  const byProfileId = new Map(
    input.payloadParticipants.map((participant) => [participant.profileId, participant]),
  );

  for (const profile of input.profiles) {
    const existing = byProfileId.get(profile.id);
    byProfileId.set(profile.id, {
      profileId: profile.id,
      accountId: profile.account_id ?? existing?.accountId ?? null,
      kind: profile.kind ?? existing?.kind ?? null,
      role: existing?.role ?? profile.kind ?? null,
      name:
        existing?.name && existing.name !== 'Participant'
          ? existing.name
          : buildDisplayName(profile),
    });
  }

  return Array.from(byProfileId.values());
}

function namesForRole(participants: ActivityRenderParticipantContext[], roles: string[]) {
  const roleSet = new Set(roles);
  return unique(
    participants
      .filter((participant) => roleSet.has(participant.role ?? participant.kind ?? ''))
      .map((participant) => participant.name),
  );
}

export async function resolveActivityRenderContext(input: {
  supabase: SupabaseServiceClient;
  event: ActivityEventRow;
  recipientProfile: ProfileRow;
}): Promise<ActivityRenderContext> {
  const payload = asRecord(input.event.payload);
  const learningSpaceId = getLearningSpaceId(input.event, payload);
  const payloadParticipants = [
    ...normalizePayloadMembers(payload.members),
    ...normalizePayloadMembers(payload.invitedMembers),
  ];
  const participantProfileIds = unique([
    ...payloadParticipants.map((participant) => participant.profileId),
    ...(await loadLearningSpaceParticipants({
      supabase: input.supabase,
      orgId: input.event.org_id,
      learningSpaceId,
    })),
  ]);
  const participantProfiles = await loadProfiles({
    supabase: input.supabase,
    orgId: input.event.org_id,
    profileIds: participantProfileIds,
  });
  const participants = mergeParticipants({
    payloadParticipants,
    profiles: participantProfiles,
  });

  const students = participants.filter(
    (participant) => (participant.role ?? participant.kind) === 'child',
  );
  const studentAccountIds = unique(
    students
      .map((participant) => participant.accountId)
      .filter((value): value is string => Boolean(value)),
  );
  const familyLinks = await loadFamilyLinks({
    supabase: input.supabase,
    orgId: input.event.org_id,
    childAccountIds: studentAccountIds,
  });
  const guardianProfiles = await loadProfilesByAccountIds({
    supabase: input.supabase,
    orgId: input.event.org_id,
    accountIds: familyLinks.map((link) => link.guardian_account_id),
  });
  const guardianNames = unique([
    ...namesForRole(participants, ['guardian']),
    ...guardianProfiles.map(buildDisplayName),
  ]);
  const teacherNames = namesForRole(participants, ['educator', 'teacher']);
  const studentNames = unique(students.map((participant) => participant.name));
  const viewerRoleKeys = await loadRoleKeys({
    supabase: input.supabase,
    orgId: input.event.org_id,
    accountId: input.recipientProfile.account_id,
  });
  const viewerIsAdminStaff =
    input.recipientProfile.kind === 'staff' ||
    viewerRoleKeys.some(
      (roleKey) => roleKey === 'owner' || roleKey === 'admin' || roleKey === 'staff',
    );

  const viewerChildAccountIds =
    input.recipientProfile.kind === 'guardian'
      ? new Set(
          familyLinks
            .filter(
              (link) => link.guardian_account_id === input.recipientProfile.account_id,
            )
            .map((link) => link.child_account_id),
        )
      : new Set<string>();
  const viewerStudentNames =
    input.recipientProfile.kind === 'child'
      ? studentNames.filter((name) =>
          participants.some(
            (participant) =>
              participant.profileId === input.recipientProfile.id &&
              participant.name === name,
          ),
        )
      : input.recipientProfile.kind === 'guardian'
        ? students
            .filter(
              (student) =>
                Boolean(student.accountId) &&
                viewerChildAccountIds.has(student.accountId as string),
            )
            .map((student) => student.name)
        : [];

  return {
    viewerProfileId: input.recipientProfile.id,
    viewerRole: input.recipientProfile.kind ?? null,
    viewerRoleKeys,
    viewerIsAdminStaff,
    classTitle: getContextTitle(payload),
    contextTitle: getContextTitle(payload),
    teacherNames,
    studentNames,
    guardianNames,
    viewerStudentNames: unique(viewerStudentNames),
    participantNamesLabel: formatNamesList(studentNames),
  };
}
