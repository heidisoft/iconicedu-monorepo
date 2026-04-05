import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import { ensureSystemProfileId } from '@iconicedu/web/lib/automation/system-profile';

type ParticipantSnapshot = {
  profileId: string;
  name: string;
  avatarUrl?: string | null;
  themeKey?: string | null;
};

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function shouldPublishSessionChangeActivity(referenceAt: string, occurredAt: string) {
  const referenceTime = toTimestamp(referenceAt);
  const occurredTime = toTimestamp(occurredAt);
  if (referenceTime === null || occurredTime === null) {
    return true;
  }
  return referenceTime >= occurredTime;
}

async function loadProfileSnapshotsByIds(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  profileIds: string[];
}) {
  const participantIds = input.profileIds.filter(Boolean);
  if (!participantIds.length) {
    return [] satisfies ParticipantSnapshot[];
  }

  const profilesResponse = await input.supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ui_theme_key')
    .eq('org_id', input.orgId)
    .in('id', participantIds)
    .is('deleted_at', null)
    .returns<
      Array<{
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        ui_theme_key: string | null;
      }>
    >();

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  const profileById = new Map((profilesResponse.data ?? []).map((row) => [row.id, row]));
  return participantIds.map((profileId) => {
    const profile = profileById.get(profileId);
    return {
      profileId,
      name: profile?.display_name ?? 'Participant',
      avatarUrl: profile?.avatar_url ?? null,
      themeKey: profile?.ui_theme_key ?? null,
    };
  });
}

export async function loadLearningSpaceParticipantSnapshot(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId: string;
}) {
  const participantsResponse = await input.supabase
    .from('learning_space_participants')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('learning_space_id', input.learningSpaceId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }

  const participantIds = (participantsResponse.data ?? []).map((row) => row.profile_id);
  return loadProfileSnapshotsByIds({
    supabase: input.supabase,
    orgId: input.orgId,
    profileIds: participantIds,
  });
}

export async function publishCancelledClassSessionActivity(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId: string;
  channelId: string;
  scheduleId: string;
  title: string;
  canceledStartAt: string;
  timezone: string | null;
  canceledReason?: string | null;
  occurredAt: string;
}) {
  if (!shouldPublishSessionChangeActivity(input.canceledStartAt, input.occurredAt)) {
    return null;
  }

  const invitedMembers = await loadLearningSpaceParticipantSnapshot({
    supabase: input.supabase,
    orgId: input.orgId,
    learningSpaceId: input.learningSpaceId,
  });
  const systemProfileId = await ensureSystemProfileId(input.supabase, input.orgId);

  return publishActivityEvent({
    supabase: input.supabase,
    orgId: input.orgId,
    eventType: 'class.session.canceled',
    occurredAt: input.occurredAt,
    sourceKind: 'system',
    actorProfileId: systemProfileId,
    scope: { kind: 'learning_space', learningSpaceId: input.learningSpaceId },
    targetRef: { kind: 'learning_space', id: input.learningSpaceId },
    payload: {
      learningSpaceId: input.learningSpaceId,
      channelId: input.channelId,
      scheduleId: input.scheduleId,
      title: input.title,
      activityPhase: 'updated',
      invitedCount: invitedMembers.length,
      invitedMembers,
      firstSessionStartAt: input.canceledStartAt,
      firstSessionTimezone: input.timezone,
      canceledStartAt: input.canceledStartAt,
      canceledReason: input.canceledReason ?? null,
      timezone: input.timezone,
    },
    dedupeKey: `schedule.exception:${input.learningSpaceId}:${input.scheduleId}:${input.canceledStartAt}:${input.occurredAt}`,
    createdBy: systemProfileId,
  });
}
