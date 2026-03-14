import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProfileRow } from '@iconicedu/shared-types';

export const DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS = [
  'Math',
  'English Language Arts',
  'Science',
  'Social Studies',
  'Computer Science',
  'Test Prep',
  'Study Skills',
  'Languages',
  'Arts',
  'Other',
] as const;

const CLASS_REQUEST_CHANNEL_PURPOSE = 'chass-requests';

export type DashboardClassRequestPayload = {
  orgSlug: string;
  studentProfileIds: string[];
  subjects: string[];
  otherSubject?: string | null;
  learningGoals?: string;
  specialRequirements?: string | null;
};

export function buildDashboardClassRequestMessage(input: {
  requesterName: string;
  studentNames: string[];
  subjects: string[];
  otherSubject?: string | null;
  learningGoals?: string;
  specialRequirements?: string | null;
}) {
  const uniqueSubjects = Array.from(new Set(input.subjects));
  const normalizedSubjects = uniqueSubjects.includes('Other')
    ? [
        ...uniqueSubjects.filter((subject) => subject !== 'Other'),
        input.otherSubject?.trim() || 'Other',
      ]
    : uniqueSubjects;

  return [
    'Class Request',
    '',
    `Requested by: ${input.requesterName}`,
    `Student(s): ${input.studentNames.join(', ')}`,
    `Subject(s): ${normalizedSubjects.join(', ')}`,
    ...(input.learningGoals?.trim()
      ? ['', 'Learning goals:', input.learningGoals.trim()]
      : []),
    '',
    'Special requirements:',
    input.specialRequirements?.trim() || 'None provided',
  ].join('\n');
}

async function findExistingClassRequestChannel(input: {
  supabase: SupabaseClient;
  orgId: string;
  requesterProfileId: string;
}) {
  const response = await input.supabase
    .from('channels')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('kind', 'channel')
    .eq('purpose', CLASS_REQUEST_CHANNEL_PURPOSE)
    .eq('created_by_profile_id', input.requesterProfileId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data?.[0]?.id ?? null;
}

async function ensureClassRequestMembers(input: {
  supabase: SupabaseClient;
  orgId: string;
  channelId: string;
  requesterProfileId: string;
  staffProfiles: ProfileRow[];
  nowIso: string;
}) {
  const participantProfileIds = Array.from(
    new Set([
      input.requesterProfileId,
      ...input.staffProfiles.map((profile) => profile.id),
    ]),
  );

  const existingMembersResponse = await input.supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .is('deleted_at', null);

  if (existingMembersResponse.error) {
    throw new Error(existingMembersResponse.error.message);
  }

  const existingMemberProfileIds = new Set(
    (existingMembersResponse.data ?? []).map((row) => row.profile_id),
  );

  const memberRows = participantProfileIds
    .filter((profileId) => !existingMemberProfileIds.has(profileId))
    .map((profileId) => ({
      id: randomUUID(),
      org_id: input.orgId,
      channel_id: input.channelId,
      profile_id: profileId,
      joined_at: input.nowIso,
      role_in_channel: null,
      created_at: input.nowIso,
      created_by: input.requesterProfileId,
      updated_at: input.nowIso,
      updated_by: input.requesterProfileId,
    }));

  if (!memberRows.length) {
    return;
  }

  const { error: memberError } = await input.supabase
    .from('channel_members')
    .insert(memberRows);
  if (memberError) {
    throw new Error(memberError.message);
  }
}

export async function createPrivateClassRequestChannel(input: {
  supabase: SupabaseClient;
  orgId: string;
  requesterProfile: ProfileRow;
  staffProfiles: ProfileRow[];
  topic: string;
  nowIso: string;
}) {
  const existingChannelId = await findExistingClassRequestChannel({
    supabase: input.supabase,
    orgId: input.orgId,
    requesterProfileId: input.requesterProfile.id,
  });

  if (existingChannelId) {
    await ensureClassRequestMembers({
      supabase: input.supabase,
      orgId: input.orgId,
      channelId: existingChannelId,
      requesterProfileId: input.requesterProfile.id,
      staffProfiles: input.staffProfiles,
      nowIso: input.nowIso,
    });

    return { channelId: existingChannelId };
  }

  const channelId = randomUUID();
  const { error: channelError } = await input.supabase.from('channels').insert({
    id: channelId,
    org_id: input.orgId,
    kind: 'channel',
    topic: input.topic,
    description: 'Class request from homepage',
    icon_key: null,
    visibility: 'private',
    purpose: CLASS_REQUEST_CHANNEL_PURPOSE,
    status: 'active',
    posting_policy_kind: 'members-only',
    allow_threads: true,
    allow_reactions: true,
    ui_defaults: {
      disabledTabs: ['members'],
    },
    created_by_profile_id: input.requesterProfile.id,
    created_at: input.nowIso,
    created_by: input.requesterProfile.id,
    updated_at: input.nowIso,
    updated_by: input.requesterProfile.id,
  });

  if (channelError) {
    throw new Error(channelError.message);
  }

  await ensureClassRequestMembers({
    supabase: input.supabase,
    orgId: input.orgId,
    channelId,
    requesterProfileId: input.requesterProfile.id,
    staffProfiles: input.staffProfiles,
    nowIso: input.nowIso,
  });

  return { channelId };
}
