import type {
  LiveSessionModeVM,
  LiveSessionProviderVM,
  ProfileRow,
} from '@iconicedu/shared-types';

import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getProfileByAccountId,
  getProfilesByIds,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getLiveSessionProvider } from '@iconicedu/web/lib/live-sessions/providers';
import { snapshotExpectedParticipantsForLiveSession } from '@iconicedu/web/lib/live-sessions/expected-participants';
import { getLiveSessionAttendancePolicy } from '@iconicedu/web/lib/live-sessions/expected-participants';
import {
  evaluateLiveSessionAttendance,
  regenerateLiveSessionAttendanceReport,
} from '@iconicedu/web/lib/live-sessions/attendance-evaluator';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ChannelLiveSessionConfigRecord = {
  enabled: boolean;
  provider: LiveSessionProviderVM;
  mode?: LiveSessionModeVM | null;
  joinUrl?: string | null;
};

type ChannelLiveSessionRowRecord = {
  id: string;
  org_id: string;
  channel_id: string;
  provider: string;
  provider_session_id?: string | null;
  session_scope_key: string;
  occurrence_key?: string | null;
  status: 'starting' | 'live' | 'ended' | 'failed';
  started_by_profile_id: string;
  started_message_id?: string | null;
  join_path: string;
  started_at: string;
  ended_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  expected_participant_count?: number | null;
  attendee_count?: number | null;
  full_attendance_count?: number | null;
  partial_attendance_count?: number | null;
  no_show_count?: number | null;
  session_duration_seconds?: number | null;
  report_generated_at?: string | null;
  attendance_policy?: Record<string, unknown> | null;
  report_status?: 'pending' | 'generated' | 'stale' | 'failed' | null;
  provider_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

type ChannelSummaryRow = {
  id: string;
  org_id: string;
  kind: string;
  topic: string;
  purpose: string;
  primary_entity_id?: string | null;
  live_session_config?: Record<string, unknown> | null;
};

export type CreateOrJoinLiveSessionResult = {
  sessionId: string;
  joinPath: string;
  status: ChannelLiveSessionRowRecord['status'];
  created: boolean;
  provider: LiveSessionProviderVM;
};

type PostJoinSideEffectsScheduler = (task: () => Promise<void>) => void;

type ChannelLiveSessionParticipantRowRecord = {
  id: string;
  org_id: string;
  live_session_id: string;
  channel_id: string;
  profile_id: string;
  join_requested_at?: string | null;
  first_joined_at?: string | null;
  last_joined_at?: string | null;
  last_left_at?: string | null;
  join_count: number;
  total_seconds?: number | null;
  expected_to_attend?: boolean | null;
  attendance_status?:
    | 'expected'
    | 'attended'
    | 'partial'
    | 'full'
    | 'no_show'
    | 'excused'
    | null;
  attendance_ratio?: number | null;
  qualified_full_attendance?: boolean | null;
  required_seconds?: number | null;
  credited_seconds?: number | null;
  evaluation_reason?: string | null;
  evaluated_at?: string | null;
  evaluation_version?: string | null;
  last_known_status: 'requested' | 'joined' | 'left';
  provider_participant_id?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

type ActivityParticipantSummary = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  themeKey: string | null;
};

type SessionActivityContext = {
  session: ChannelLiveSessionRowRecord;
  channel: ChannelSummaryRow;
  scope: Awaited<ReturnType<typeof resolveChannelLiveSessionScope>>;
};

function parseChannelLiveSessionConfig(
  value: unknown,
): ChannelLiveSessionConfigRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.enabled !== true) {
    return null;
  }

  if (
    candidate.provider !== 'daily' &&
    candidate.provider !== 'zoom' &&
    candidate.provider !== 'jitsi' &&
    candidate.provider !== 'custom'
  ) {
    return null;
  }

  return {
    enabled: true,
    provider: candidate.provider,
    mode:
      candidate.mode === 'audio' || candidate.mode === 'video' ? candidate.mode : null,
    joinUrl:
      candidate.provider === 'custom' &&
      typeof candidate.joinUrl === 'string' &&
      candidate.joinUrl.trim().length > 0
        ? candidate.joinUrl.trim()
        : null,
  };
}

async function getChannelSummary(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelId: string,
) {
  return supabase
    .from('channels')
    .select('id, org_id, kind, topic, purpose, primary_entity_id, live_session_config')
    .eq('org_id', orgId)
    .eq('id', channelId)
    .is('deleted_at', null)
    .maybeSingle<ChannelSummaryRow>();
}

async function verifyChannelMembership(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelId: string,
  profileIds: string[],
) {
  if (!profileIds.length) {
    return false;
  }

  const response = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .in('profile_id', profileIds)
    .is('deleted_at', null)
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return Boolean(response.data?.[0]?.id);
}

async function resolveAuthorizedLiveSessionProfileIds(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  profile: ProfileRow;
}) {
  const resolvedProfileIds = new Set<string>([input.profile.id]);

  if (input.profile.kind !== 'guardian' || !input.profile.account_id) {
    return Array.from(resolvedProfileIds);
  }

  const familyLinksResponse = await input.supabase
    .from('family_links')
    .select('child_account_id')
    .eq('org_id', input.orgId)
    .eq('guardian_account_id', input.profile.account_id)
    .is('deleted_at', null)
    .returns<Array<{ child_account_id: string | null }>>();

  if (familyLinksResponse.error) {
    throw new Error(familyLinksResponse.error.message);
  }

  const childAccountIds = Array.from(
    new Set(
      (familyLinksResponse.data ?? [])
        .map((row) => row.child_account_id)
        .filter((childAccountId): childAccountId is string => Boolean(childAccountId)),
    ),
  );

  if (!childAccountIds.length) {
    return Array.from(resolvedProfileIds);
  }

  const childProfilesResponse = await input.supabase
    .from('profiles')
    .select('id')
    .in('account_id', childAccountIds)
    .eq('org_id', input.orgId)
    .eq('kind', 'child')
    .is('deleted_at', null)
    .returns<Array<{ id: string }>>();

  if (childProfilesResponse.error) {
    throw new Error(childProfilesResponse.error.message);
  }

  (childProfilesResponse.data ?? []).forEach((row) => {
    if (row.id) {
      resolvedProfileIds.add(row.id);
    }
  });

  return Array.from(resolvedProfileIds);
}

async function loadActivityParticipants(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  profileIds: string[];
}) {
  const uniqueProfileIds = Array.from(new Set(input.profileIds.filter(Boolean)));
  if (!uniqueProfileIds.length) {
    return [] satisfies ActivityParticipantSummary[];
  }

  const response = await getProfilesByIds(input.supabase, input.orgId, uniqueProfileIds);
  if ('error' in response && response.error) {
    throw new Error(response.error.message);
  }

  return (response.data ?? []).map((profile) => ({
    profileId: profile.id,
    displayName:
      profile.display_name ??
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ??
      'Participant',
    avatarUrl: profile.avatar_url ?? null,
    themeKey: profile.ui_theme_key ?? null,
  }));
}

function resolveSessionActivityLearningSpaceId(input: SessionActivityContext) {
  return (
    input.channel.primary_entity_id ??
    (input.scope.schedule?.source.kind === 'class_session'
      ? input.scope.schedule.source.learningSpaceId
      : null) ??
    (typeof input.session.app_metadata?.learningSpaceId === 'string'
      ? input.session.app_metadata.learningSpaceId
      : null)
  );
}

function resolveSessionActivityScheduleId(input: SessionActivityContext) {
  return (
    input.scope.schedule?.ids.id ??
    (typeof input.session.app_metadata?.scheduleId === 'string'
      ? input.session.app_metadata.scheduleId
      : null)
  );
}

function resolveSessionLearningSpaceIdFromMetadata(session: ChannelLiveSessionRowRecord) {
  return typeof session.app_metadata?.learningSpaceId === 'string'
    ? session.app_metadata.learningSpaceId
    : null;
}

function resolveSessionScheduleIdFromMetadata(session: ChannelLiveSessionRowRecord) {
  return typeof session.app_metadata?.scheduleId === 'string'
    ? session.app_metadata.scheduleId
    : null;
}

function resolveSessionActivityTitle(input: SessionActivityContext) {
  return (
    input.scope.schedule?.title ??
    (typeof input.session.app_metadata?.scheduleTitle === 'string'
      ? input.session.app_metadata.scheduleTitle
      : null) ??
    input.channel.topic ??
    (input.channel.purpose === 'learning-space' ? 'Class' : 'Live session')
  );
}

function resolveSessionActivityMode(input: SessionActivityContext) {
  const mode =
    typeof input.session.app_metadata?.mode === 'string'
      ? input.session.app_metadata.mode
      : null;
  return mode === 'audio' || mode === 'video' ? mode : 'video';
}

function buildLiveSessionTimelineScope(channelId: string) {
  return { kind: 'channel' as const, channelId };
}

function buildMemberJoinedActivityDedupeKey(
  sessionId: string,
  profileId: string,
  occurredAt: string,
) {
  return `member.joined:${sessionId}:${profileId}:${occurredAt}`;
}

function isoOffsetSeconds(value: string, seconds: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

async function hasRecentAppMemberJoinedActivity(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  sessionId: string;
  memberProfileId: string;
  occurredAt: string;
}) {
  const response = await input.supabase
    .from('activity_events')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('event_type', 'member.joined')
    .eq('source_kind', 'profile')
    .contains('scope', buildLiveSessionTimelineScope(input.channelId))
    .contains('payload', {
      liveSessionId: input.sessionId,
      memberProfileId: input.memberProfileId,
    })
    .gte('occurred_at', isoOffsetSeconds(input.occurredAt, -90))
    .lte('occurred_at', isoOffsetSeconds(input.occurredAt, 90))
    .is('deleted_at', null)
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return Boolean(response.data?.[0]?.id);
}

async function publishSessionStartedActivity(input: {
  supabase: SupabaseServiceClient;
  context: SessionActivityContext;
  actorProfileId: string;
  startedByDisplayName: string;
  participants?: ActivityParticipantSummary[];
  joinPath: string;
  occurredAt: string;
}) {
  const learningSpaceId = resolveSessionActivityLearningSpaceId(input.context);
  const scheduleId = resolveSessionActivityScheduleId(input.context);
  const title = resolveSessionActivityTitle(input.context);
  const mode = resolveSessionActivityMode(input.context);
  console.info('[live-session:debug][service] publishing session.started', {
    sessionId: input.context.session.id,
    channelId: input.context.session.channel_id,
    actorProfileId: input.actorProfileId,
    learningSpaceId,
    scheduleId,
    occurredAt: input.occurredAt,
    isScheduledSessionWindow: input.context.scope.isScheduledSessionWindow === true,
    occurrenceStart:
      input.context.scope.occurrenceKey ?? input.context.session.occurrence_key ?? null,
    mode,
    title,
  });

  await publishActivityEvent({
    supabase: input.supabase,
    orgId: input.context.session.org_id,
    eventType: 'session.started',
    occurredAt: input.occurredAt,
    sourceKind: 'profile',
    actorProfileId: input.actorProfileId,
    scope: buildLiveSessionTimelineScope(input.context.session.channel_id),
    objectRef: { kind: 'session', id: input.context.session.id },
    targetRef: learningSpaceId
      ? { kind: 'learning_space', id: learningSpaceId }
      : undefined,
    payload: {
      liveSessionId: input.context.session.id,
      channelId: input.context.session.channel_id,
      learningSpaceId,
      scheduleId,
      title,
      joinPath: input.joinPath,
      mode,
      startedAt: input.occurredAt,
      isScheduledSessionWindow: input.context.scope.isScheduledSessionWindow === true,
      startedByDisplayName: input.startedByDisplayName,
      occurrenceStart:
        input.context.scope.occurrenceKey ?? input.context.session.occurrence_key ?? null,
      occurrenceLabel:
        input.context.scope.occurrenceLabel ??
        (typeof input.context.session.app_metadata?.occurrenceLabel === 'string'
          ? input.context.session.app_metadata.occurrenceLabel
          : null),
      participants: input.participants ?? [],
    },
    dedupeKey: `session.started:${input.context.session.id}`,
    createdBy: input.actorProfileId,
  });
}

async function publishMemberJoinedActivity(input: {
  supabase: SupabaseServiceClient;
  context: SessionActivityContext;
  actorProfileId: string;
  member: ActivityParticipantSummary | null;
  occurredAt: string;
  sourceKind: 'profile' | 'provider_webhook';
}) {
  const learningSpaceId = resolveSessionActivityLearningSpaceId(input.context);
  const scheduleId = resolveSessionActivityScheduleId(input.context);
  const title = resolveSessionActivityTitle(input.context);
  const mode = resolveSessionActivityMode(input.context);
  const memberProfileId = input.member?.profileId ?? input.actorProfileId;
  console.info('[live-session:debug][service] preparing member.joined publish', {
    sessionId: input.context.session.id,
    channelId: input.context.session.channel_id,
    sourceKind: input.sourceKind,
    actorProfileId: input.actorProfileId,
    memberProfileId,
    learningSpaceId,
    scheduleId,
    occurredAt: input.occurredAt,
    isScheduledSessionWindow: input.context.scope.isScheduledSessionWindow === true,
    occurrenceStart:
      input.context.scope.occurrenceKey ?? input.context.session.occurrence_key ?? null,
    mode,
    title,
  });

  if (input.sourceKind === 'provider_webhook') {
    const recentlyPublishedByApp = await hasRecentAppMemberJoinedActivity({
      supabase: input.supabase,
      orgId: input.context.session.org_id,
      channelId: input.context.session.channel_id,
      sessionId: input.context.session.id,
      memberProfileId,
      occurredAt: input.occurredAt,
    });
    if (recentlyPublishedByApp) {
      console.info(
        '[live-session:debug][service] skipping provider member.joined publish due to recent app event',
        {
          sessionId: input.context.session.id,
          channelId: input.context.session.channel_id,
          memberProfileId,
          occurredAt: input.occurredAt,
        },
      );
      return;
    }
  }

  await publishActivityEvent({
    supabase: input.supabase,
    orgId: input.context.session.org_id,
    eventType: 'member.joined',
    occurredAt: input.occurredAt,
    sourceKind: input.sourceKind,
    actorProfileId: input.sourceKind === 'profile' ? input.actorProfileId : null,
    scope: buildLiveSessionTimelineScope(input.context.session.channel_id),
    objectRef: { kind: 'session', id: input.context.session.id },
    targetRef: learningSpaceId
      ? { kind: 'learning_space', id: learningSpaceId }
      : undefined,
    payload: {
      liveSessionId: input.context.session.id,
      channelId: input.context.session.channel_id,
      learningSpaceId,
      scheduleId,
      title,
      mode,
      isScheduledSessionWindow: input.context.scope.isScheduledSessionWindow === true,
      occurrenceStart:
        input.context.scope.occurrenceKey ?? input.context.session.occurrence_key ?? null,
      occurrenceLabel:
        input.context.scope.occurrenceLabel ??
        (typeof input.context.session.app_metadata?.occurrenceLabel === 'string'
          ? input.context.session.app_metadata.occurrenceLabel
          : null),
      memberProfileId,
      memberDisplayName: input.member?.displayName ?? 'Participant',
      memberAvatarUrl: input.member?.avatarUrl ?? null,
      memberThemeKey: input.member?.themeKey ?? null,
      members: input.member
        ? [
            {
              profileId: input.member.profileId,
              displayName: input.member.displayName,
              avatarUrl: input.member.avatarUrl,
              themeKey: input.member.themeKey,
            },
          ]
        : undefined,
      joinedAt: input.occurredAt,
    },
    dedupeKey: buildMemberJoinedActivityDedupeKey(
      input.context.session.id,
      memberProfileId,
      input.occurredAt,
    ),
    createdBy: input.sourceKind === 'profile' ? input.actorProfileId : null,
  });
  console.info('[live-session:debug][service] published member.joined', {
    sessionId: input.context.session.id,
    channelId: input.context.session.channel_id,
    memberProfileId,
    sourceKind: input.sourceKind,
    occurredAt: input.occurredAt,
  });
}

async function hasScheduledSessionStartedActivity(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  learningSpaceId: string;
  occurrenceStart: string;
}) {
  const response = await input.supabase
    .from('activity_events')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('event_type', 'session.started')
    .contains('scope', buildLiveSessionTimelineScope(input.channelId))
    .contains('payload', {
      channelId: input.channelId,
      learningSpaceId: input.learningSpaceId,
      occurrenceStart: input.occurrenceStart,
      isScheduledSessionWindow: true,
    })
    .is('deleted_at', null)
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return Boolean(response.data?.[0]?.id);
}

async function shouldPublishSessionStartedForJoin(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  learningSpaceId: string | null;
  occurrenceStart: string | null;
  isScheduledSessionWindow: boolean;
}) {
  console.info('[live-session:debug][service] evaluating session.started publish', {
    channelId: input.channelId,
    learningSpaceId: input.learningSpaceId,
    occurrenceStart: input.occurrenceStart,
    isScheduledSessionWindow: input.isScheduledSessionWindow,
  });
  if (
    !input.isScheduledSessionWindow ||
    !input.learningSpaceId ||
    !input.occurrenceStart
  ) {
    console.info(
      '[live-session:debug][service] session.started publish allowed (non-scheduled context)',
    );
    return true;
  }

  const alreadyStarted = await hasScheduledSessionStartedActivity({
    supabase: input.supabase,
    orgId: input.orgId,
    channelId: input.channelId,
    learningSpaceId: input.learningSpaceId,
    occurrenceStart: input.occurrenceStart,
  });

  console.info('[live-session:debug][service] session.started prior event check', {
    channelId: input.channelId,
    learningSpaceId: input.learningSpaceId,
    occurrenceStart: input.occurrenceStart,
    alreadyStarted,
  });
  return !alreadyStarted;
}

function logPostJoinSideEffectsError(input: {
  channelId: string;
  sessionId: string;
  profileId: string;
  error: unknown;
}) {
  console.error('[live-sessions] post-join side effects failed', {
    channelId: input.channelId,
    sessionId: input.sessionId,
    profileId: input.profileId,
    error: input.error instanceof Error ? input.error.message : input.error,
  });
}

function runPostJoinSideEffects(
  scheduler: PostJoinSideEffectsScheduler | undefined,
  input: {
    channelId: string;
    sessionId: string;
    profileId: string;
    task: () => Promise<void>;
  },
) {
  console.info('[live-session:debug][service] runPostJoinSideEffects queued', {
    channelId: input.channelId,
    sessionId: input.sessionId,
    profileId: input.profileId,
    usesExternalScheduler: Boolean(scheduler),
  });
  const run =
    scheduler ??
    ((task) => {
      void task();
    });
  run(async () => {
    console.info('[live-session:debug][service] runPostJoinSideEffects started', {
      channelId: input.channelId,
      sessionId: input.sessionId,
      profileId: input.profileId,
    });
    try {
      await input.task();
      console.info('[live-session:debug][service] runPostJoinSideEffects completed', {
        channelId: input.channelId,
        sessionId: input.sessionId,
        profileId: input.profileId,
      });
    } catch (error) {
      logPostJoinSideEffectsError({
        channelId: input.channelId,
        sessionId: input.sessionId,
        profileId: input.profileId,
        error,
      });
    }
  });
}

async function getActiveLiveSession(
  supabase: SupabaseServiceClient,
  orgId: string,
  scopeKey: string,
) {
  return supabase
    .from('channel_live_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('session_scope_key', scopeKey)
    .in('status', ['starting', 'live'])
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<ChannelLiveSessionRowRecord>();
}

async function upsertJoinRequestedParticipant(input: {
  supabase: SupabaseServiceClient;
  session: ChannelLiveSessionRowRecord;
  profileId: string;
}) {
  const now = new Date().toISOString();
  const response = await input.supabase
    .from('channel_live_session_participants')
    .upsert(
      {
        org_id: input.session.org_id,
        live_session_id: input.session.id,
        channel_id: input.session.channel_id,
        profile_id: input.profileId,
        join_requested_at: now,
        last_known_status: 'requested',
        updated_at: now,
      },
      { onConflict: 'org_id,live_session_id,profile_id' },
    )
    .select('id')
    .maybeSingle<{ id: string }>();

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function insertParticipantEvent(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  liveSessionId: string;
  provider: LiveSessionProviderVM;
  eventType:
    | 'join_requested'
    | 'session_started'
    | 'session_ended'
    | 'participant_joined'
    | 'participant_left';
  profileId: string | null;
  payload: Record<string, unknown>;
  normalizedEventVersion?: string | null;
  rawProviderPayload?: Record<string, unknown>;
  correlationKey?: string | null;
  providerParticipantId?: string | null;
  providerEventId?: string | null;
  occurredAt?: string;
  source?: 'app' | 'provider_webhook';
}) {
  const response = await input.supabase
    .from('channel_live_session_participant_events')
    .insert({
      org_id: input.orgId,
      live_session_id: input.liveSessionId,
      channel_id: input.channelId,
      profile_id: input.profileId,
      provider_participant_id: input.providerParticipantId ?? null,
      provider: input.provider,
      event_type: input.eventType,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      source: input.source ?? 'app',
      provider_event_id: input.providerEventId ?? null,
      normalized_event_version: input.normalizedEventVersion ?? null,
      raw_provider_payload: input.rawProviderPayload ?? {},
      correlation_key: input.correlationKey ?? null,
      payload: input.payload,
    });

  if (response.error) {
    if (input.providerEventId && response.error.code === '23505') {
      return;
    }
    throw new Error(response.error.message);
  }
}

async function markLiveSessionReportStatus(
  supabase: SupabaseServiceClient,
  session: ChannelLiveSessionRowRecord,
  reportStatus: 'pending' | 'generated' | 'stale' | 'failed',
) {
  const response = await supabase
    .from('channel_live_sessions')
    .update({
      report_status: reportStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .eq('org_id', session.org_id);

  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function getLiveSessionByProviderSessionId(input: {
  supabase: SupabaseServiceClient;
  provider: LiveSessionProviderVM;
  providerSessionId: string;
}) {
  return input.supabase
    .from('channel_live_sessions')
    .select('*')
    .eq('provider', input.provider)
    .eq('provider_session_id', input.providerSessionId)
    .is('deleted_at', null)
    .maybeSingle<ChannelLiveSessionRowRecord>();
}

async function getLiveSessionParticipant(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  liveSessionId: string;
  profileId: string;
}) {
  return input.supabase
    .from('channel_live_session_participants')
    .select('*')
    .eq('org_id', input.orgId)
    .eq('live_session_id', input.liveSessionId)
    .eq('profile_id', input.profileId)
    .is('deleted_at', null)
    .maybeSingle<ChannelLiveSessionParticipantRowRecord>();
}

async function upsertProviderParticipantState(input: {
  supabase: SupabaseServiceClient;
  session: ChannelLiveSessionRowRecord;
  profileId: string;
  providerParticipantId?: string | null;
  providerMetadata?: Record<string, unknown>;
  occurredAt: string;
  eventType: 'participant_joined' | 'participant_left';
}) {
  const existingResponse = await getLiveSessionParticipant({
    supabase: input.supabase,
    orgId: input.session.org_id,
    liveSessionId: input.session.id,
    profileId: input.profileId,
  });
  if (existingResponse.error) {
    throw new Error(existingResponse.error.message);
  }

  const existing = existingResponse.data ?? null;

  if (!existing) {
    const joinCount = input.eventType === 'participant_joined' ? 1 : 0;
    const insertResponse = await input.supabase
      .from('channel_live_session_participants')
      .insert({
        org_id: input.session.org_id,
        live_session_id: input.session.id,
        channel_id: input.session.channel_id,
        profile_id: input.profileId,
        join_requested_at:
          input.eventType === 'participant_joined' ? input.occurredAt : null,
        first_joined_at:
          input.eventType === 'participant_joined' ? input.occurredAt : null,
        last_joined_at:
          input.eventType === 'participant_joined' ? input.occurredAt : null,
        last_left_at: input.eventType === 'participant_left' ? input.occurredAt : null,
        join_count: joinCount,
        last_known_status: input.eventType === 'participant_joined' ? 'joined' : 'left',
        provider_participant_id: input.providerParticipantId ?? null,
        provider_metadata: input.providerMetadata ?? {},
        app_metadata: {},
      });

    if (insertResponse.error) {
      throw new Error(insertResponse.error.message);
    }
    return;
  }

  const updates: Record<string, unknown> = {
    provider_participant_id:
      input.providerParticipantId ?? existing.provider_participant_id ?? null,
    provider_metadata: {
      ...(existing.provider_metadata ?? {}),
      ...(input.providerMetadata ?? {}),
    },
    updated_at: new Date().toISOString(),
  };

  if (input.eventType === 'participant_joined') {
    const nextJoinCount =
      existing.last_known_status === 'joined'
        ? existing.join_count
        : existing.join_count + 1;
    updates.join_requested_at = existing.join_requested_at ?? input.occurredAt;
    updates.first_joined_at = existing.first_joined_at ?? input.occurredAt;
    updates.last_joined_at = input.occurredAt;
    updates.last_known_status = 'joined';
    updates.join_count = nextJoinCount;
  } else {
    updates.last_left_at = input.occurredAt;
    updates.last_known_status = 'left';

    if (existing.last_joined_at) {
      const joinedAt = new Date(existing.last_joined_at).getTime();
      const leftAt = new Date(input.occurredAt).getTime();
      if (Number.isFinite(joinedAt) && Number.isFinite(leftAt) && leftAt >= joinedAt) {
        const durationSeconds = Math.round((leftAt - joinedAt) / 1000);
        updates.total_seconds = (existing.total_seconds ?? 0) + durationSeconds;
      }
    }
  }

  const updateResponse = await input.supabase
    .from('channel_live_session_participants')
    .update(updates)
    .eq('id', existing.id)
    .eq('org_id', existing.org_id);

  if (updateResponse.error) {
    throw new Error(updateResponse.error.message);
  }
}

export async function createOrJoinLiveSession(input: {
  supabase: SupabaseServerClient;
  serviceSupabase: SupabaseServiceClient;
  authUserId: string;
  channelId: string;
  orgSlug: string;
  schedulePostJoinSideEffects?: PostJoinSideEffectsScheduler;
}): Promise<CreateOrJoinLiveSessionResult> {
  console.info('[live-session:debug][service] createOrJoinLiveSession started', {
    authUserId: input.authUserId,
    channelId: input.channelId,
    orgSlug: input.orgSlug,
    hasScheduler: Boolean(input.schedulePostJoinSideEffects),
  });
  const [accountResponse] = await Promise.all([
    getAccountByAuthUserId(input.supabase, input.authUserId),
  ]);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }
  const account = accountResponse.data;

  const profileResponse = await getProfileByAccountId(input.supabase, account.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }
  const profile = profileResponse.data;

  const channelResponse = await getChannelSummary(
    input.serviceSupabase,
    account.org_id,
    input.channelId,
  );
  if (!channelResponse.data) {
    throw new Error('Channel not found');
  }
  const channel = channelResponse.data;

  const authorizedProfileIds = await resolveAuthorizedLiveSessionProfileIds({
    supabase: input.serviceSupabase,
    orgId: channel.org_id,
    profile,
  });
  const hasMembership = await verifyChannelMembership(
    input.serviceSupabase,
    channel.org_id,
    channel.id,
    authorizedProfileIds,
  );
  if (!hasMembership) {
    throw new Error('Unauthorized');
  }

  const liveSessionConfig = parseChannelLiveSessionConfig(channel.live_session_config);
  if (!liveSessionConfig) {
    throw new Error('Live sessions are not enabled for this channel');
  }

  const scope = await resolveChannelLiveSessionScope({
    supabase: input.serviceSupabase,
    orgId: channel.org_id,
    channelId: channel.id,
  });
  console.info('[live-session:debug][service] resolved live-session scope', {
    channelId: channel.id,
    scopeKey: scope.scopeKey,
    occurrenceKey: scope.occurrenceKey ?? null,
    scheduleId: scope.schedule?.ids.id ?? null,
    scheduleLearningSpaceId:
      scope.schedule?.source.kind === 'class_session'
        ? scope.schedule.source.learningSpaceId
        : null,
    isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
  });

  const activeSessionResponse = await getActiveLiveSession(
    input.serviceSupabase,
    channel.org_id,
    scope.scopeKey,
  );
  if (activeSessionResponse.error) {
    throw new Error(activeSessionResponse.error.message);
  }

  const now = new Date().toISOString();
  const existingSession = activeSessionResponse.data ?? null;
  if (existingSession) {
    console.info('[live-session:debug][service] reusing existing live session', {
      channelId: channel.id,
      sessionId: existingSession.id,
      status: existingSession.status,
      occurrenceKey: existingSession.occurrence_key ?? null,
    });
    const sessionActivityParticipant =
      (
        await loadActivityParticipants({
          supabase: input.serviceSupabase,
          orgId: existingSession.org_id,
          profileIds: [profile.id],
        })
      )[0] ?? null;
    await snapshotExpectedParticipantsForLiveSession({
      supabase: input.serviceSupabase,
      session: existingSession,
      scope,
      createdBy: profile.id,
    });
    await upsertJoinRequestedParticipant({
      supabase: input.serviceSupabase,
      session: existingSession,
      profileId: profile.id,
    });
    runPostJoinSideEffects(input.schedulePostJoinSideEffects, {
      channelId: existingSession.channel_id,
      sessionId: existingSession.id,
      profileId: profile.id,
      task: async () => {
        await insertParticipantEvent({
          supabase: input.serviceSupabase,
          orgId: existingSession.org_id,
          channelId: existingSession.channel_id,
          liveSessionId: existingSession.id,
          provider: existingSession.provider as LiveSessionProviderVM,
          eventType: 'join_requested',
          profileId: profile.id,
          payload: {
            reused: true,
          },
        });
        if (!scope.isScheduledSessionWindow) {
          console.info(
            '[live-session:debug][service] existing session join is outside scheduled window; publishing session.started',
          );
          await publishSessionStartedActivity({
            supabase: input.serviceSupabase,
            context: {
              session: existingSession,
              channel: channel,
              scope,
            },
            actorProfileId: profile.id,
            startedByDisplayName:
              sessionActivityParticipant?.displayName ?? 'Participant',
            participants: sessionActivityParticipant ? [sessionActivityParticipant] : [],
            joinPath: existingSession.join_path,
            occurredAt: now,
          });
        } else {
          console.info(
            '[live-session:debug][service] existing session join is within scheduled window; skipping extra session.started publish',
          );
        }
        await publishMemberJoinedActivity({
          supabase: input.serviceSupabase,
          context: {
            session: existingSession,
            channel: channel,
            scope,
          },
          actorProfileId: profile.id,
          member: sessionActivityParticipant,
          occurredAt: now,
          sourceKind: 'profile',
        });
      },
    });

    return {
      sessionId: existingSession.id,
      joinPath: existingSession.join_path,
      status: existingSession.status,
      created: false,
      provider: existingSession.provider as LiveSessionProviderVM,
    };
  }

  const joinPath =
    liveSessionConfig.provider === 'custom'
      ? (liveSessionConfig.joinUrl ?? '')
      : `/${input.orgSlug}/live-sessions/temp`;

  if (liveSessionConfig.provider === 'custom' && !joinPath) {
    throw new Error('Custom live session join URL is missing');
  }
  const learningSpaceId =
    channel.primary_entity_id ??
    (scope.schedule?.source.kind === 'class_session'
      ? scope.schedule.source.learningSpaceId
      : null);
  console.info('[live-session:debug][service] creating new live session', {
    channelId: channel.id,
    provider: liveSessionConfig.provider,
    joinPath,
    learningSpaceId,
    scheduleId: scope.schedule?.ids.id ?? null,
    scopeKey: scope.scopeKey,
    occurrenceKey: scope.occurrenceKey ?? null,
  });
  const insertResponse = await input.serviceSupabase
    .from('channel_live_sessions')
    .insert({
      org_id: channel.org_id,
      channel_id: channel.id,
      provider: liveSessionConfig.provider,
      session_scope_key: scope.scopeKey,
      occurrence_key: scope.occurrenceKey ?? null,
      status: 'starting',
      started_by_profile_id: profile.id,
      join_path: joinPath,
      attendance_policy: getLiveSessionAttendancePolicy(null),
      report_status: 'pending',
      app_metadata: {
        channelTopic: channel.topic ?? null,
        learningSpaceId,
        mode: liveSessionConfig.mode ?? 'video',
        isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
        occurrenceEndAt: scope.occurrenceEndAt ?? null,
        occurrenceLabel: scope.occurrenceLabel ?? null,
        scheduleId: scope.schedule?.ids.id ?? null,
        scheduleTitle: scope.schedule?.title ?? null,
      },
      started_at: now,
      created_at: now,
      updated_at: now,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('*')
    .single<ChannelLiveSessionRowRecord>();

  if (insertResponse.error) {
    console.warn('[live-session:debug][service] create session insert failed', {
      channelId: channel.id,
      scopeKey: scope.scopeKey,
      error: insertResponse.error.message,
    });
    const fallbackSessionResponse = await getActiveLiveSession(
      input.serviceSupabase,
      channel.org_id,
      scope.scopeKey,
    );
    if (fallbackSessionResponse.data) {
      const fallbackSession = fallbackSessionResponse.data;
      console.info(
        '[live-session:debug][service] using fallback existing session after insert failure',
        {
          channelId: channel.id,
          sessionId: fallbackSession.id,
        },
      );
      const sessionActivityParticipant =
        (
          await loadActivityParticipants({
            supabase: input.serviceSupabase,
            orgId: fallbackSession.org_id,
            profileIds: [profile.id],
          })
        )[0] ?? null;
      await snapshotExpectedParticipantsForLiveSession({
        supabase: input.serviceSupabase,
        session: fallbackSession,
        scope,
        createdBy: profile.id,
      });
      await upsertJoinRequestedParticipant({
        supabase: input.serviceSupabase,
        session: fallbackSession,
        profileId: profile.id,
      });
      runPostJoinSideEffects(input.schedulePostJoinSideEffects, {
        channelId: fallbackSession.channel_id,
        sessionId: fallbackSession.id,
        profileId: profile.id,
        task: async () => {
          await insertParticipantEvent({
            supabase: input.serviceSupabase,
            orgId: fallbackSession.org_id,
            channelId: fallbackSession.channel_id,
            liveSessionId: fallbackSession.id,
            provider: fallbackSession.provider as LiveSessionProviderVM,
            eventType: 'join_requested',
            profileId: profile.id,
            payload: {
              reused: true,
              source: 'insert-conflict',
            },
          });
          if (!scope.isScheduledSessionWindow) {
            await publishSessionStartedActivity({
              supabase: input.serviceSupabase,
              context: {
                session: fallbackSession,
                channel: channel,
                scope,
              },
              actorProfileId: profile.id,
              startedByDisplayName:
                sessionActivityParticipant?.displayName ?? 'Participant',
              participants: sessionActivityParticipant
                ? [sessionActivityParticipant]
                : [],
              joinPath: fallbackSession.join_path,
              occurredAt: now,
            });
          }
          await publishMemberJoinedActivity({
            supabase: input.serviceSupabase,
            context: {
              session: fallbackSession,
              channel: channel,
              scope,
            },
            actorProfileId: profile.id,
            member: sessionActivityParticipant,
            occurredAt: now,
            sourceKind: 'profile',
          });
        },
      });
      return {
        sessionId: fallbackSession.id,
        joinPath: fallbackSession.join_path,
        status: fallbackSession.status,
        created: false,
        provider: fallbackSession.provider as LiveSessionProviderVM,
      };
    }
    throw new Error(insertResponse.error.message);
  }

  const session = insertResponse.data;
  console.info('[live-session:debug][service] created live session row', {
    channelId: channel.id,
    sessionId: session.id,
    provider: session.provider,
    occurrenceKey: session.occurrence_key ?? null,
    joinPath: session.join_path,
  });
  const sessionActivityParticipants = await loadActivityParticipants({
    supabase: input.serviceSupabase,
    orgId: session.org_id,
    profileIds: [profile.id],
  });
  const sessionTitle =
    scope.schedule?.title ??
    channel.topic ??
    (channel.purpose === 'learning-space' ? 'Class' : 'Live session');

  try {
    await snapshotExpectedParticipantsForLiveSession({
      supabase: input.serviceSupabase,
      session,
      scope,
      createdBy: profile.id,
    });

    if (liveSessionConfig.provider === 'custom') {
      const updateResponse = await input.serviceSupabase
        .from('channel_live_sessions')
        .update({
          provider_metadata: {},
          join_path: joinPath,
          status: 'live',
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        })
        .eq('id', session.id)
        .eq('org_id', session.org_id)
        .select('*')
        .single<ChannelLiveSessionRowRecord>();

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      await upsertJoinRequestedParticipant({
        supabase: input.serviceSupabase,
        session: updateResponse.data,
        profileId: profile.id,
      });
      runPostJoinSideEffects(input.schedulePostJoinSideEffects, {
        channelId: session.channel_id,
        sessionId: session.id,
        profileId: profile.id,
        task: async () => {
          const learningSpaceId =
            channel.primary_entity_id ??
            (scope.schedule?.source.kind === 'class_session'
              ? scope.schedule.source.learningSpaceId
              : null);
          const scheduleId = scope.schedule?.ids.id ?? null;
          const occurrenceStart = scope.occurrenceKey ?? null;
          const shouldPublishSessionStarted = await shouldPublishSessionStartedForJoin({
            supabase: input.serviceSupabase,
            orgId: session.org_id,
            channelId: session.channel_id,
            learningSpaceId,
            occurrenceStart,
            isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
          });
          console.info(
            '[live-session:debug][service] custom provider started-event decision',
            {
              sessionId: session.id,
              channelId: session.channel_id,
              shouldPublishSessionStarted,
              learningSpaceId,
              scheduleId,
              occurrenceStart,
            },
          );
          await insertParticipantEvent({
            supabase: input.serviceSupabase,
            orgId: session.org_id,
            channelId: session.channel_id,
            liveSessionId: session.id,
            provider: liveSessionConfig.provider,
            eventType: 'session_started',
            profileId: profile.id,
            payload: {
              external: true,
            },
            normalizedEventVersion: 'v1',
          });
          if (shouldPublishSessionStarted) {
            await publishActivityEvent({
              supabase: input.serviceSupabase,
              orgId: session.org_id,
              eventType: 'session.started',
              occurredAt: now,
              sourceKind: 'profile',
              actorProfileId: profile.id,
              scope: buildLiveSessionTimelineScope(session.channel_id),
              objectRef: { kind: 'session', id: session.id },
              targetRef: learningSpaceId
                ? { kind: 'learning_space', id: learningSpaceId }
                : undefined,
              payload: {
                liveSessionId: session.id,
                channelId: session.channel_id,
                learningSpaceId,
                scheduleId,
                title: sessionTitle,
                joinPath,
                mode: liveSessionConfig.mode ?? 'video',
                startedAt: now,
                isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
                startedByDisplayName:
                  profile.display_name ??
                  ([profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
                    'User'),
                occurrenceStart,
                occurrenceLabel: scope.occurrenceLabel ?? null,
                participants: sessionActivityParticipants,
              },
              dedupeKey: `session.started:${session.id}`,
              createdBy: profile.id,
            });
          }
          await publishMemberJoinedActivity({
            supabase: input.serviceSupabase,
            context: {
              session: updateResponse.data,
              channel: channel,
              scope,
            },
            actorProfileId: profile.id,
            member: sessionActivityParticipants[0] ?? null,
            occurredAt: now,
            sourceKind: 'profile',
          });
          await insertParticipantEvent({
            supabase: input.serviceSupabase,
            orgId: session.org_id,
            channelId: session.channel_id,
            liveSessionId: session.id,
            provider: liveSessionConfig.provider,
            eventType: 'join_requested',
            profileId: profile.id,
            payload: {
              created: true,
              external: true,
            },
            normalizedEventVersion: 'v1',
          });
        },
      });

      return {
        sessionId: session.id,
        joinPath,
        status: 'live',
        created: true,
        provider: liveSessionConfig.provider,
      };
    }

    const provider = getLiveSessionProvider(liveSessionConfig.provider);
    const providerSession = await provider.createSession({
      sessionId: session.id,
      orgId: session.org_id,
      channelId: session.channel_id,
      scopeKey: session.session_scope_key,
      mode: liveSessionConfig.mode ?? 'video',
    });

    const resolvedJoinPath = `/${input.orgSlug}/live-sessions/${session.id}`;
    const updateResponse = await input.serviceSupabase
      .from('channel_live_sessions')
      .update({
        provider_session_id: providerSession.providerSessionId,
        provider_metadata: providerSession.providerMetadata ?? {},
        join_path: resolvedJoinPath,
        status: 'live',
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq('id', session.id)
      .eq('org_id', session.org_id)
      .select('*')
      .single<ChannelLiveSessionRowRecord>();

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message);
    }

    await upsertJoinRequestedParticipant({
      supabase: input.serviceSupabase,
      session: updateResponse.data,
      profileId: profile.id,
    });
    runPostJoinSideEffects(input.schedulePostJoinSideEffects, {
      channelId: session.channel_id,
      sessionId: session.id,
      profileId: profile.id,
      task: async () => {
        const learningSpaceId =
          channel.primary_entity_id ??
          (scope.schedule?.source.kind === 'class_session'
            ? scope.schedule.source.learningSpaceId
            : null);
        const scheduleId = scope.schedule?.ids.id ?? null;
        const occurrenceStart = scope.occurrenceKey ?? null;
        const shouldPublishSessionStarted = await shouldPublishSessionStartedForJoin({
          supabase: input.serviceSupabase,
          orgId: session.org_id,
          channelId: session.channel_id,
          learningSpaceId,
          occurrenceStart,
          isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
        });
        console.info('[live-session:debug][service] provider started-event decision', {
          sessionId: session.id,
          channelId: session.channel_id,
          shouldPublishSessionStarted,
          learningSpaceId,
          scheduleId,
          occurrenceStart,
        });
        await insertParticipantEvent({
          supabase: input.serviceSupabase,
          orgId: session.org_id,
          channelId: session.channel_id,
          liveSessionId: session.id,
          provider: liveSessionConfig.provider,
          eventType: 'session_started',
          profileId: profile.id,
          payload: {},
          normalizedEventVersion: 'v1',
        });
        if (shouldPublishSessionStarted) {
          await publishActivityEvent({
            supabase: input.serviceSupabase,
            orgId: session.org_id,
            eventType: 'session.started',
            occurredAt: now,
            sourceKind: 'profile',
            actorProfileId: profile.id,
            scope: buildLiveSessionTimelineScope(session.channel_id),
            objectRef: { kind: 'session', id: session.id },
            targetRef: learningSpaceId
              ? { kind: 'learning_space', id: learningSpaceId }
              : undefined,
            payload: {
              liveSessionId: session.id,
              channelId: session.channel_id,
              learningSpaceId,
              scheduleId,
              title: sessionTitle,
              joinPath: resolvedJoinPath,
              mode: liveSessionConfig.mode ?? 'video',
              startedAt: now,
              isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
              startedByDisplayName:
                profile.display_name ??
                ([profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
                  'User'),
              occurrenceStart,
              occurrenceLabel: scope.occurrenceLabel ?? null,
              participants: sessionActivityParticipants,
            },
            dedupeKey: `session.started:${session.id}`,
            createdBy: profile.id,
          });
        }
        await publishMemberJoinedActivity({
          supabase: input.serviceSupabase,
          context: {
            session: updateResponse.data,
            channel: channel,
            scope,
          },
          actorProfileId: profile.id,
          member: sessionActivityParticipants[0] ?? null,
          occurredAt: now,
          sourceKind: 'profile',
        });
        await insertParticipantEvent({
          supabase: input.serviceSupabase,
          orgId: session.org_id,
          channelId: session.channel_id,
          liveSessionId: session.id,
          provider: liveSessionConfig.provider,
          eventType: 'join_requested',
          profileId: profile.id,
          payload: {
            created: true,
          },
          normalizedEventVersion: 'v1',
        });
      },
    });

    return {
      sessionId: session.id,
      joinPath: resolvedJoinPath,
      status: 'live',
      created: true,
      provider: liveSessionConfig.provider,
    };
  } catch (error) {
    await input.serviceSupabase
      .from('channel_live_sessions')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq('id', session.id)
      .eq('org_id', session.org_id);
    throw error;
  }
}

export async function getLiveSessionById(
  supabase: SupabaseServiceClient,
  liveSessionId: string,
) {
  return supabase
    .from('channel_live_sessions')
    .select('*')
    .eq('id', liveSessionId)
    .is('deleted_at', null)
    .maybeSingle<ChannelLiveSessionRowRecord>();
}

export async function resolveLiveSessionJoinAccess(input: {
  serviceSupabase: SupabaseServiceClient;
  liveSessionId: string;
  profile: ProfileRow;
}) {
  const sessionResponse = await getLiveSessionById(
    input.serviceSupabase,
    input.liveSessionId,
  );
  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message);
  }
  if (!sessionResponse.data) {
    throw new Error('Live session not found');
  }
  if (sessionResponse.data.status !== 'live') {
    throw new Error('Live session is not active');
  }

  const authorizedProfileIds = await resolveAuthorizedLiveSessionProfileIds({
    supabase: input.serviceSupabase,
    orgId: sessionResponse.data.org_id,
    profile: input.profile,
  });
  const hasMembership = await verifyChannelMembership(
    input.serviceSupabase,
    sessionResponse.data.org_id,
    sessionResponse.data.channel_id,
    authorizedProfileIds,
  );
  if (!hasMembership) {
    throw new Error('Unauthorized');
  }

  const provider = getLiveSessionProvider(
    sessionResponse.data.provider as LiveSessionProviderVM,
  );
  const displayName =
    input.profile.display_name ??
    ([input.profile.first_name, input.profile.last_name].filter(Boolean).join(' ') ||
      'User');
  const joinAccess = await provider.getJoinAccess({
    sessionId: sessionResponse.data.id,
    providerSessionId: sessionResponse.data.provider_session_id ?? null,
    providerMetadata: sessionResponse.data.provider_metadata ?? {},
    profileId: input.profile.id,
    displayName,
  });

  return {
    session: sessionResponse.data,
    joinAccess,
  };
}

export async function processLiveSessionProviderWebhook(input: {
  supabase: SupabaseServiceClient;
  provider: LiveSessionProviderVM;
  headers: Headers;
  body: string;
}) {
  const provider = getLiveSessionProvider(input.provider);
  const events = await provider.normalizeWebhook({
    headers: input.headers,
    body: input.body,
  });

  for (const event of events) {
    const sessionResponse = await getLiveSessionByProviderSessionId({
      supabase: input.supabase,
      provider: event.provider,
      providerSessionId: event.providerSessionId,
    });

    if (sessionResponse.error || !sessionResponse.data) {
      continue;
    }

    const session = sessionResponse.data;

    await insertParticipantEvent({
      supabase: input.supabase,
      orgId: session.org_id,
      channelId: session.channel_id,
      liveSessionId: session.id,
      provider: event.provider,
      eventType: event.eventType,
      profileId: event.profileId ?? null,
      providerParticipantId: event.providerParticipantId ?? null,
      providerEventId: event.providerEventId ?? null,
      occurredAt: event.occurredAt,
      source: 'provider_webhook',
      payload: event.payload,
      normalizedEventVersion: 'v1',
      rawProviderPayload: event.raw ?? event.payload,
      correlationKey: event.correlationKey ?? null,
    });

    if (
      event.profileId &&
      (event.eventType === 'participant_joined' || event.eventType === 'participant_left')
    ) {
      await upsertProviderParticipantState({
        supabase: input.supabase,
        session,
        profileId: event.profileId,
        providerParticipantId: event.providerParticipantId ?? null,
        providerMetadata: event.payload,
        occurredAt: event.occurredAt,
        eventType: event.eventType,
      });
    }

    if (event.eventType === 'session_started') {
      const updateResponse = await input.supabase
        .from('channel_live_sessions')
        .update({
          status: 'live',
          started_at: session.started_at ?? event.occurredAt,
          report_status:
            session.report_status === 'generated'
              ? 'stale'
              : (session.report_status ?? 'pending'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
        .eq('org_id', session.org_id);

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }
    }

    if (
      event.eventType === 'participant_joined' ||
      event.eventType === 'participant_left'
    ) {
      if (event.profileId) {
        const activityParticipants = await loadActivityParticipants({
          supabase: input.supabase,
          orgId: session.org_id,
          profileIds: [event.profileId],
        });
        const participant = activityParticipants[0];
        if (event.eventType === 'participant_joined') {
          await publishMemberJoinedActivity({
            supabase: input.supabase,
            context: {
              session,
              channel: {
                id: session.channel_id,
                org_id: session.org_id,
                kind: 'channel',
                topic:
                  typeof session.app_metadata?.channelTopic === 'string'
                    ? session.app_metadata.channelTopic
                    : typeof session.app_metadata?.scheduleTitle === 'string'
                      ? session.app_metadata.scheduleTitle
                      : 'Live session',
                purpose:
                  typeof session.app_metadata?.learningSpaceId === 'string'
                    ? 'learning-space'
                    : 'general',
                primary_entity_id:
                  typeof session.app_metadata?.learningSpaceId === 'string'
                    ? session.app_metadata.learningSpaceId
                    : null,
              },
              scope: {
                scopeKey: session.session_scope_key,
                occurrenceKey:
                  typeof session.occurrence_key === 'string'
                    ? session.occurrence_key
                    : null,
                occurrenceLabel:
                  typeof session.app_metadata?.occurrenceLabel === 'string'
                    ? session.app_metadata.occurrenceLabel
                    : null,
                occurrenceEndAt:
                  typeof session.app_metadata?.occurrenceEndAt === 'string'
                    ? session.app_metadata.occurrenceEndAt
                    : null,
              },
            },
            actorProfileId: participant?.profileId ?? event.profileId,
            member: participant ?? null,
            occurredAt: event.occurredAt,
            sourceKind: 'provider_webhook',
          });
        } else {
          const learningSpaceId = resolveSessionLearningSpaceIdFromMetadata(session);
          const scheduleId = resolveSessionScheduleIdFromMetadata(session);
          await publishActivityEvent({
            supabase: input.supabase,
            orgId: session.org_id,
            eventType: 'member.removed',
            occurredAt: event.occurredAt,
            sourceKind: 'provider_webhook',
            actorProfileId: null,
            scope: buildLiveSessionTimelineScope(session.channel_id),
            objectRef: { kind: 'session', id: session.id },
            targetRef: learningSpaceId
              ? { kind: 'learning_space', id: learningSpaceId }
              : undefined,
            payload: {
              liveSessionId: session.id,
              channelId: session.channel_id,
              learningSpaceId,
              scheduleId,
              title:
                typeof session.app_metadata?.scheduleTitle === 'string'
                  ? session.app_metadata.scheduleTitle
                  : 'Class',
              occurrenceStart:
                typeof session.occurrence_key === 'string'
                  ? session.occurrence_key
                  : null,
              occurrenceLabel:
                typeof session.app_metadata?.occurrenceLabel === 'string'
                  ? session.app_metadata.occurrenceLabel
                  : null,
              mode:
                typeof session.app_metadata?.mode === 'string' &&
                (session.app_metadata.mode === 'audio' ||
                  session.app_metadata.mode === 'video')
                  ? session.app_metadata.mode
                  : 'video',
              memberProfileId: participant?.profileId ?? event.profileId,
              memberDisplayName:
                participant?.displayName ?? event.participantDisplayName ?? 'Participant',
              memberAvatarUrl: participant?.avatarUrl ?? null,
              memberThemeKey: participant?.themeKey ?? null,
              members: participant
                ? [
                    {
                      profileId: participant.profileId,
                      displayName: participant.displayName,
                      avatarUrl: participant.avatarUrl,
                      themeKey: participant.themeKey,
                    },
                  ]
                : undefined,
              leftAt: event.occurredAt,
            },
            dedupeKey: `${event.eventType}:${session.id}:${event.profileId}:${event.occurredAt}`,
          });
        }
      }

      if (session.report_status === 'generated') {
        await markLiveSessionReportStatus(input.supabase, session, 'stale');
      }
    }

    if (event.eventType === 'session_ended') {
      const updateResponse = await input.supabase
        .from('channel_live_sessions')
        .update({
          status: 'ended',
          ended_at: event.occurredAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
        .eq('org_id', session.org_id);

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
      }

      const participantsResponse = await input.supabase
        .from('channel_live_session_participants')
        .select('*')
        .eq('org_id', session.org_id)
        .eq('live_session_id', session.id)
        .eq('last_known_status', 'joined')
        .is('deleted_at', null)
        .returns<ChannelLiveSessionParticipantRowRecord[]>();

      if (participantsResponse.error) {
        throw new Error(participantsResponse.error.message);
      }

      const sessionParticipants = await loadActivityParticipants({
        supabase: input.supabase,
        orgId: session.org_id,
        profileIds: (participantsResponse.data ?? []).map(
          (participant) => participant.profile_id,
        ),
      });

      for (const participant of participantsResponse.data ?? []) {
        await upsertProviderParticipantState({
          supabase: input.supabase,
          session,
          profileId: participant.profile_id,
          providerParticipantId: participant.provider_participant_id ?? null,
          providerMetadata: participant.provider_metadata ?? {},
          occurredAt: event.occurredAt,
          eventType: 'participant_left',
        });
      }

      await evaluateLiveSessionAttendance({
        supabase: input.supabase,
        sessionId: session.id,
        orgId: session.org_id,
      });

      const learningSpaceId = resolveSessionLearningSpaceIdFromMetadata(session);
      const scheduleId = resolveSessionScheduleIdFromMetadata(session);
      await publishActivityEvent({
        supabase: input.supabase,
        orgId: session.org_id,
        eventType: 'session.ended',
        occurredAt: event.occurredAt,
        sourceKind: 'provider_webhook',
        actorProfileId: null,
        scope: buildLiveSessionTimelineScope(session.channel_id),
        objectRef: { kind: 'session', id: session.id },
        targetRef: learningSpaceId
          ? { kind: 'learning_space', id: learningSpaceId }
          : undefined,
        payload: {
          liveSessionId: session.id,
          channelId: session.channel_id,
          learningSpaceId,
          scheduleId,
          title:
            typeof session.app_metadata?.scheduleTitle === 'string'
              ? session.app_metadata.scheduleTitle
              : 'Live session',
          mode:
            typeof session.app_metadata?.mode === 'string' &&
            (session.app_metadata.mode === 'audio' ||
              session.app_metadata.mode === 'video')
              ? session.app_metadata.mode
              : 'video',
          occurrenceStart:
            typeof session.occurrence_key === 'string' ? session.occurrence_key : null,
          occurrenceLabel:
            typeof session.app_metadata?.occurrenceLabel === 'string'
              ? session.app_metadata.occurrenceLabel
              : null,
          endedAt: event.occurredAt,
          participants: sessionParticipants,
        },
        dedupeKey: `session.ended:${session.id}`,
      });
    }
  }

  return { processed: events.length };
}

export async function regenerateLiveSessionAttendanceReportById(input: {
  supabase: SupabaseServiceClient;
  sessionId: string;
  orgId?: string | null;
}) {
  return regenerateLiveSessionAttendanceReport(input);
}

export {
  snapshotExpectedParticipantsForLiveSession,
  evaluateLiveSessionAttendance,
  regenerateLiveSessionAttendanceReport,
};
