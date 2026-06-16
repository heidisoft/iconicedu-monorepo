import type {
  LiveSessionModeVM,
  LiveSessionProviderVM,
  AccountRow,
  ProfileRow,
} from '@iconicedu/shared-types';

import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getLiveSessionProvider } from '@iconicedu/web/lib/live-sessions/providers';
import { snapshotExpectedParticipantsForLiveSession } from '@iconicedu/web/lib/live-sessions/expected-participants';
import { getLiveSessionAttendancePolicy } from '@iconicedu/web/lib/live-sessions/expected-participants';
import {
  evaluateLiveSessionAttendance,
  regenerateLiveSessionAttendanceReport,
} from '@iconicedu/web/lib/live-sessions/attendance-evaluator';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { reportWebObservedError } from '@iconicedu/web/lib/analytics/report-error';

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

async function assertLearningSpaceIsActionable(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId: string | null;
}) {
  if (!input.learningSpaceId) return;

  const response = await input.supabase
    .from('learning_spaces')
    .select('status, archived_at')
    .eq('org_id', input.orgId)
    .eq('id', input.learningSpaceId)
    .is('deleted_at', null)
    .maybeSingle<{ status: string | null; archived_at: string | null }>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (response.data?.archived_at || response.data?.status === 'archived') {
    throw new Error('Archived classrooms cannot start or join live sessions');
  }
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

async function shouldPublishSessionStartedForJoin(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  learningSpaceId: string | null;
  occurrenceStart: string | null;
  isScheduledSessionWindow: boolean;
}) {
  if (
    !input.isScheduledSessionWindow ||
    !input.learningSpaceId ||
    !input.occurrenceStart
  ) {
    return true;
  }
  return true;
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
  const run =
    scheduler ??
    ((task) => {
      void task();
    });
  run(async () => {
    try {
      await input.task();
    } catch (error) {
      reportWebObservedError({
        error,
        source: 'web.live_sessions.post_join_side_effects',
        message: 'Post-join side effects failed',
        context: {
          channelId: input.channelId,
          sessionId: input.sessionId,
          profileId: input.profileId,
        },
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

function isActiveLiveSessionCompatibleWithConfig(input: {
  session: ChannelLiveSessionRowRecord;
  config: ChannelLiveSessionConfigRecord;
  orgSlug: string;
}) {
  if (input.session.provider !== input.config.provider) {
    return false;
  }

  if (input.config.provider === 'custom') {
    return input.session.join_path === input.config.joinUrl;
  }

  return input.session.join_path.startsWith(`/${input.orgSlug}/live-sessions/`);
}

async function endActiveLiveSessionForConfigChange(input: {
  supabase: SupabaseServiceClient;
  session: ChannelLiveSessionRowRecord;
  profileId: string;
  now: string;
}) {
  const response = await input.supabase
    .from('channel_live_sessions')
    .update({
      status: 'ended',
      ended_at: input.now,
      updated_at: input.now,
      updated_by: input.profileId,
      app_metadata: {
        ...(input.session.app_metadata ?? {}),
        endedReason: 'live_session_config_changed',
        previousProvider: input.session.provider,
      },
    })
    .eq('id', input.session.id)
    .eq('org_id', input.session.org_id);

  if (response.error) {
    throw new Error(response.error.message);
  }
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
  serviceSupabase: SupabaseServiceClient;
  actor: {
    authUserId: string;
    account: Pick<AccountRow, 'id' | 'org_id'>;
    profile: ProfileRow;
  };
  channelId: string;
  orgSlug: string;
  schedulePostJoinSideEffects?: PostJoinSideEffectsScheduler;
}): Promise<CreateOrJoinLiveSessionResult> {
  const account = input.actor.account;
  const profile = input.actor.profile;

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
  const learningSpaceId =
    channel.primary_entity_id ??
    (scope.schedule?.source.kind === 'class_session'
      ? scope.schedule.source.learningSpaceId
      : null);
  await assertLearningSpaceIsActionable({
    supabase: input.serviceSupabase,
    orgId: channel.org_id,
    learningSpaceId,
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
  if (
    existingSession &&
    isActiveLiveSessionCompatibleWithConfig({
      session: existingSession,
      config: liveSessionConfig,
      orgSlug: input.orgSlug,
    })
  ) {
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
  if (existingSession) {
    await endActiveLiveSessionForConfigChange({
      supabase: input.serviceSupabase,
      session: existingSession,
      profileId: profile.id,
      now,
    });
  }

  const joinPath =
    liveSessionConfig.provider === 'custom'
      ? (liveSessionConfig.joinUrl ?? '')
      : `/${input.orgSlug}/live-sessions/temp`;

  if (liveSessionConfig.provider === 'custom' && !joinPath) {
    throw new Error('Custom live session join URL is missing');
  }
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
    const fallbackSessionResponse = await getActiveLiveSession(
      input.serviceSupabase,
      channel.org_id,
      scope.scopeKey,
    );
    if (fallbackSessionResponse.data) {
      const fallbackSession = fallbackSessionResponse.data;
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
          const occurrenceStart = scope.occurrenceKey ?? null;
          const shouldPublishSessionStarted = await shouldPublishSessionStartedForJoin({
            supabase: input.serviceSupabase,
            orgId: session.org_id,
            channelId: session.channel_id,
            learningSpaceId,
            occurrenceStart,
            isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
          });

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
          void shouldPublishSessionStarted;
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
        const occurrenceStart = scope.occurrenceKey ?? null;
        const shouldPublishSessionStarted = await shouldPublishSessionStartedForJoin({
          supabase: input.serviceSupabase,
          orgId: session.org_id,
          channelId: session.channel_id,
          learningSpaceId,
          occurrenceStart,
          isScheduledSessionWindow: scope.isScheduledSessionWindow === true,
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
        void shouldPublishSessionStarted;
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
        void event.profileId;
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

      void sessionParticipants;
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
