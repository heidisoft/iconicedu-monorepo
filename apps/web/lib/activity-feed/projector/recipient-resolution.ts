import type { ActivityEventRow, FamilyLinkRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

import { getFamilyLinksByOrg } from '@iconicedu/web/lib/family/queries/families.query';
import { getProfilesByAccountIds, getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function loadGuardianProfileIdsForChildProfileIds(
  supabase: SupabaseServiceClient,
  orgId: string,
  childProfileIds: string[],
) {
  if (!childProfileIds.length) {
    return [];
  }

  const childProfilesResponse = await getProfilesByIds(supabase, orgId, childProfileIds);
  if ('error' in childProfilesResponse && childProfilesResponse.error) {
    throw new Error(childProfilesResponse.error.message);
  }

  const childAccountIds = (childProfilesResponse.data ?? [])
    .filter((profile) => profile.kind === 'child')
    .map((profile) => profile.account_id);

  if (!childAccountIds.length) {
    return [];
  }

  const familyLinksResponse = await getFamilyLinksByOrg(supabase, orgId);
  if ('error' in familyLinksResponse && familyLinksResponse.error) {
    throw new Error(familyLinksResponse.error.message);
  }

  const guardianAccountIds = (familyLinksResponse.data ?? [])
    .filter((link: FamilyLinkRow) => childAccountIds.includes(link.child_account_id))
    .map((link: FamilyLinkRow) => link.guardian_account_id);

  if (!guardianAccountIds.length) {
    return [];
  }

  const guardianProfilesResponse = await getProfilesByAccountIds(
    supabase,
    orgId,
    unique(guardianAccountIds),
  );
  if ('error' in guardianProfilesResponse && guardianProfilesResponse.error) {
    throw new Error(guardianProfilesResponse.error.message);
  }

  return unique((guardianProfilesResponse.data ?? []).map((profile: ProfileRow) => profile.id));
}

async function resolveLearningSpaceRecipients(
  supabase: SupabaseServiceClient,
  orgId: string,
  learningSpaceId: string,
) {
  const participantsResponse = await supabase
    .from('learning_space_participants')
    .select('profile_id')
    .eq('org_id', orgId)
    .eq('learning_space_id', learningSpaceId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }

  const participantIds = unique((participantsResponse.data ?? []).map((row) => row.profile_id));
  const guardianIds = await loadGuardianProfileIdsForChildProfileIds(supabase, orgId, participantIds);
  return unique([...participantIds, ...guardianIds]);
}

async function resolveChannelRecipients(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelId: string,
) {
  const membersResponse = await supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (membersResponse.error) {
    throw new Error(membersResponse.error.message);
  }

  const memberIds = unique((membersResponse.data ?? []).map((row) => row.profile_id));
  const guardianIds = await loadGuardianProfileIdsForChildProfileIds(supabase, orgId, memberIds);
  return unique([...memberIds, ...guardianIds]);
}

export async function resolveRecipientsForActivityEvent(
  supabase: SupabaseServiceClient,
  event: ActivityEventRow,
) {
  const scope = asRecord(event.scope);
  const audienceRules = Array.isArray(event.audience_rules) ? event.audience_rules : [];
  const scopeKind = typeof scope.kind === 'string' ? scope.kind : 'global';

  if (scopeKind === 'user' && typeof scope.userId === 'string') {
    return [scope.userId];
  }

  if (scopeKind === 'learning_space' && typeof scope.learningSpaceId === 'string') {
    return resolveLearningSpaceRecipients(supabase, event.org_id, scope.learningSpaceId);
  }

  if (scopeKind === 'channel' && typeof scope.channelId === 'string') {
    return resolveChannelRecipients(supabase, event.org_id, scope.channelId);
  }

  const usersOnlyRule = audienceRules.find(
    (rule) =>
      rule &&
      typeof rule === 'object' &&
      !Array.isArray(rule) &&
      (rule as Record<string, unknown>).kind === 'users_only',
  ) as Record<string, unknown> | undefined;

  if (usersOnlyRule && Array.isArray(usersOnlyRule.userIds)) {
    return unique(usersOnlyRule.userIds.filter((value): value is string => typeof value === 'string'));
  }

  return [];
}
