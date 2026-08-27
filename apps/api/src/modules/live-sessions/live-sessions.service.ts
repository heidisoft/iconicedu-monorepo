import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  expandRecurringEvents,
  getClassScheduleOccurrenceIdentity,
  reportObservedError,
} from '@iconicedu/utils';
import type {
  ClassSessionJoinAvailabilityVM,
  ClassSessionJoinResultVM,
  LiveSessionModeVM,
  LiveSessionProviderVM,
  AccountRow,
  ProfileRow,
} from '@iconicedu/shared-types';

import {
  apiFeatureFlagKeys,
  evaluateApiBooleanFlag,
} from '@iconicedu/api/lib/flags/posthog-openfeature';
import {
  createSupabaseServiceClient,
  type SupabaseServiceClient,
} from '@iconicedu/api/lib/supabase/service';
import { resolveLiveSessionActor } from '@iconicedu/api/modules/live-sessions/live-session-actor';
import type {
  ClassSessionJoinAvailabilityDto,
  ClassSessionJoinAvailabilityRangeDto,
  JoinChannelLiveSessionDto,
  JoinClassSessionOccurrenceDto,
} from '@iconicedu/api/modules/live-sessions/dto/join-class-session-occurrence.dto';

import { getLiveSessionProvider } from '@iconicedu/api/lib/live-sessions/providers';
import {
  getLiveSessionAttendancePolicy,
  snapshotExpectedParticipantsForLiveSession,
} from '@iconicedu/api/lib/live-sessions/expected-participants';
import { buildClassSchedulesByOrg } from '@iconicedu/api/lib/schedules/class-schedule.builder';
import {
  resolveChannelLiveSessionScope,
  resolveClassSessionOccurrenceScope,
  type ResolvedClassSessionOccurrence,
} from '@iconicedu/api/lib/live-sessions/scope';

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
      reportObservedError({
        error,
        source: 'api.live_sessions.post_join_side_effects',
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
  if (existingSession) {
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

// ─── Occurrence-aware class-session join (issue #195) ────────────────────────

/**
 * Roles that may join a visible class-session occurrence without holding a
 * `channel_members` row. Staff and system profiles supervise every classroom in
 * their organization, so their dashboards already list these occurrences; without
 * this branch they would see a Join control the endpoint then rejects.
 *
 * This is a supervision scope, not public access: the occurrence must still exist,
 * be visible, and belong to an active classroom in the *actor's own* org.
 */
const SUPERVISORY_PROFILE_KINDS = new Set(['staff', 'system']);

/**
 * Grace period after an occurrence ends during which Join stays actionable, so a
 * class that runs slightly long does not strand the room.
 */
const OCCURRENCE_PAST_GRACE_MS = 30 * 60 * 1000;

/**
 * Legacy window: without the rollout flag, only an occurrence already within 15
 * minutes of starting is joinable. Keeping the API on the same rule when the flag
 * is off means a stale client cannot render an action the endpoint would reject,
 * and vice versa.
 */
const LEGACY_EARLY_JOIN_ALLOWANCE_MS = 15 * 60 * 1000;

async function verifyScheduleParticipation(
  supabase: SupabaseServiceClient,
  orgId: string,
  scheduleId: string,
  profileIds: string[],
) {
  if (!profileIds.length) {
    return false;
  }

  const response = await supabase
    .from('class_schedule_participants')
    .select('id')
    .eq('org_id', orgId)
    .eq('schedule_id', scheduleId)
    .in('profile_id', profileIds)
    .is('deleted_at', null)
    .limit(1)
    .returns<Array<{ id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return Boolean(response.data?.[0]?.id);
}

async function isLearningSpaceArchived(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  learningSpaceId: string | null;
}) {
  if (!input.learningSpaceId) {
    return false;
  }

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

  return Boolean(response.data?.archived_at || response.data?.status === 'archived');
}

/**
 * May this actor see and use Join for one exact occurrence?
 *
 * Role-independent by design (issue #195): the same questions are asked of a
 * guardian, a student, an educator, and a staff observer. What differs is only
 * *how* each one is connected to the occurrence.
 */
async function authorizeOccurrenceJoin(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  scheduleId: string;
  profile: ProfileRow;
}) {
  const authorizedProfileIds = await resolveAuthorizedLiveSessionProfileIds({
    supabase: input.supabase,
    orgId: input.orgId,
    profile: input.profile,
  });

  // Direct channel membership — the actor, or a guardian's linked child.
  const hasMembership = await verifyChannelMembership(
    input.supabase,
    input.orgId,
    input.channelId,
    authorizedProfileIds,
  );
  if (hasMembership) {
    return true;
  }

  // Named on the schedule itself. Covers an educator or student assigned to the
  // class whose channel membership row has not been created yet.
  const isScheduleParticipant = await verifyScheduleParticipation(
    input.supabase,
    input.orgId,
    input.scheduleId,
    authorizedProfileIds,
  );
  if (isScheduleParticipant) {
    return true;
  }

  return SUPERVISORY_PROFILE_KINDS.has(input.profile.kind);
}

export type ClassSessionJoinIneligibleReason =
  | 'not_authorized'
  | 'live_sessions_disabled'
  | 'classroom_archived'
  | 'occurrence_not_found'
  | 'occurrence_cancelled'
  | 'occurrence_past'
  | 'feature_disabled';

export type ClassSessionJoinAvailability = {
  eligible: boolean;
  reason: ClassSessionJoinIneligibleReason | null;
  action: 'join_integrated' | 'open_external' | null;
  provider: LiveSessionProviderVM | null;
  occurrence: {
    orgId: string;
    channelId: string;
    scheduleId: string;
    occurrenceKey: string;
  };
  effectiveStartAt: string;
  effectiveEndAt: string;
};

export type ResolveClassSessionJoinAvailabilityInput = {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  profile: ProfileRow;
  scheduleId: string;
  occurrenceKey: string;
  /** Result of `enable-any-visible-class-session-join` for this actor. */
  anyVisibleJoinEnabled: boolean;
  now?: Date;
};

type ResolvedAvailability = {
  availability: ClassSessionJoinAvailability;
  resolved: ResolvedClassSessionOccurrence | null;
  liveSessionConfig: ChannelLiveSessionConfigRecord | null;
};

async function evaluateClassSessionJoinAvailability(
  input: ResolveClassSessionJoinAvailabilityInput,
): Promise<ResolvedAvailability> {
  const now = input.now ?? new Date();

  const resolved = await resolveClassSessionOccurrenceScope({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey,
  });

  if (!resolved) {
    return {
      resolved: null,
      liveSessionConfig: null,
      availability: {
        eligible: false,
        reason: 'occurrence_not_found',
        action: null,
        provider: null,
        occurrence: {
          orgId: input.orgId,
          channelId: '',
          scheduleId: input.scheduleId,
          occurrenceKey: input.occurrenceKey,
        },
        effectiveStartAt: input.occurrenceKey,
        effectiveEndAt: input.occurrenceKey,
      },
    };
  }

  const identity = {
    orgId: input.orgId,
    channelId: resolved.channelId,
    scheduleId: input.scheduleId,
    occurrenceKey: resolved.occurrenceKey,
  };
  const ineligible = (
    reason: ClassSessionJoinIneligibleReason,
    liveSessionConfig: ChannelLiveSessionConfigRecord | null = null,
  ): ResolvedAvailability => ({
    resolved,
    liveSessionConfig,
    availability: {
      eligible: false,
      reason,
      action: null,
      provider: null,
      occurrence: identity,
      effectiveStartAt: resolved.effectiveStartAt,
      effectiveEndAt: resolved.effectiveEndAt,
    },
  });

  const isAuthorized = await authorizeOccurrenceJoin({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    channelId: resolved.channelId,
    scheduleId: input.scheduleId,
    profile: input.profile,
  });
  if (!isAuthorized) {
    return ineligible('not_authorized');
  }

  if (resolved.isCancelled) {
    return ineligible('occurrence_cancelled');
  }

  const archived = await isLearningSpaceArchived({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    learningSpaceId: resolved.learningSpaceId,
  });
  if (archived) {
    return ineligible('classroom_archived');
  }

  const channelResponse = await getChannelSummary(
    input.serviceSupabase,
    input.orgId,
    resolved.channelId,
  );
  if (channelResponse.error) {
    throw new Error(channelResponse.error.message);
  }
  const liveSessionConfig = channelResponse.data
    ? parseChannelLiveSessionConfig(channelResponse.data.live_session_config)
    : null;
  if (!liveSessionConfig) {
    return ineligible('live_sessions_disabled');
  }

  const endedAtMs = new Date(resolved.effectiveEndAt).getTime();
  if (endedAtMs + OCCURRENCE_PAST_GRACE_MS <= now.getTime()) {
    return ineligible('occurrence_past', liveSessionConfig);
  }

  if (!input.anyVisibleJoinEnabled) {
    const startsAtMs = new Date(resolved.effectiveStartAt).getTime();
    if (startsAtMs - LEGACY_EARLY_JOIN_ALLOWANCE_MS > now.getTime()) {
      return ineligible('feature_disabled', liveSessionConfig);
    }
  }

  return {
    resolved,
    liveSessionConfig,
    availability: {
      eligible: true,
      reason: null,
      action:
        liveSessionConfig.provider === 'custom' ? 'open_external' : 'join_integrated',
      provider: liveSessionConfig.provider,
      occurrence: identity,
      effectiveStartAt: resolved.effectiveStartAt,
      effectiveEndAt: resolved.effectiveEndAt,
    },
  };
}

export async function resolveClassSessionJoinAvailability(
  input: ResolveClassSessionJoinAvailabilityInput,
): Promise<ClassSessionJoinAvailability> {
  const { availability } = await evaluateClassSessionJoinAvailability(input);
  return availability;
}

export class ClassSessionJoinDeniedError extends Error {
  constructor(readonly reason: ClassSessionJoinIneligibleReason) {
    super(reason);
    this.name = 'ClassSessionJoinDeniedError';
  }
}

export type JoinClassSessionOccurrenceResult = {
  sessionId: string;
  joinPath: string;
  status: ChannelLiveSessionRowRecord['status'];
  created: boolean;
  provider: LiveSessionProviderVM;
  occurrence: ClassSessionJoinAvailability['occurrence'];
};

/**
 * Create or reuse the live room for one exact class-session occurrence.
 *
 * Unlike `createOrJoinLiveSession`, which resolves whichever occurrence happens to
 * be inside the current join window, this always targets the occurrence the caller
 * named. That is what stops an early click on a future card from creating a
 * generic `channel:<id>` huddle and mis-attributing attendance (issue #195).
 */
export async function joinClassSessionOccurrence(input: {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  orgSlug: string;
  profile: ProfileRow;
  scheduleId: string;
  occurrenceKey: string;
  anyVisibleJoinEnabled: boolean;
  now?: Date;
  schedulePostJoinSideEffects?: PostJoinSideEffectsScheduler;
}): Promise<JoinClassSessionOccurrenceResult> {
  const { availability, resolved, liveSessionConfig } =
    await evaluateClassSessionJoinAvailability({
      serviceSupabase: input.serviceSupabase,
      orgId: input.orgId,
      profile: input.profile,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      anyVisibleJoinEnabled: input.anyVisibleJoinEnabled,
      now: input.now,
    });

  if (!availability.eligible || !resolved || !liveSessionConfig) {
    throw new ClassSessionJoinDeniedError(availability.reason ?? 'not_authorized');
  }

  const profile = input.profile;
  const scope = resolved.scope;
  const existingSession = await findActiveSessionForScopeKeys(
    input.serviceSupabase,
    input.orgId,
    resolved.compatibleScopeKeys,
  );

  if (existingSession) {
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
          payload: { reused: true, occurrenceKey: resolved.occurrenceKey },
        });
      },
    });

    return {
      sessionId: existingSession.id,
      joinPath: existingSession.join_path,
      status: existingSession.status,
      created: false,
      provider: existingSession.provider as LiveSessionProviderVM,
      occurrence: availability.occurrence,
    };
  }

  const now = new Date().toISOString();
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
      org_id: input.orgId,
      channel_id: resolved.channelId,
      provider: liveSessionConfig.provider,
      session_scope_key: scope.scopeKey,
      occurrence_key: resolved.occurrenceKey,
      status: 'starting',
      started_by_profile_id: profile.id,
      join_path: joinPath,
      attendance_policy: getLiveSessionAttendancePolicy(null),
      report_status: 'pending',
      app_metadata: {
        channelTopic: null,
        learningSpaceId: resolved.learningSpaceId,
        mode: liveSessionConfig.mode ?? 'video',
        isScheduledSessionWindow: true,
        occurrenceEndAt: resolved.effectiveEndAt,
        occurrenceLabel: scope.occurrenceLabel ?? null,
        scheduleId: input.scheduleId,
        scheduleTitle: resolved.schedule.title,
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
    // A concurrent join for the same occurrence won the insert race. Reuse it so
    // both callers land in one room rather than creating a second.
    const fallbackSession = await findActiveSessionForScopeKeys(
      input.serviceSupabase,
      input.orgId,
      resolved.compatibleScopeKeys,
    );
    if (!fallbackSession) {
      throw new Error(insertResponse.error.message);
    }

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
            occurrenceKey: resolved.occurrenceKey,
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
      occurrence: availability.occurrence,
    };
  }

  const session = insertResponse.data;

  try {
    await snapshotExpectedParticipantsForLiveSession({
      supabase: input.serviceSupabase,
      session,
      scope,
      createdBy: profile.id,
    });

    const isExternal = liveSessionConfig.provider === 'custom';
    const resolvedJoinPath = isExternal
      ? joinPath
      : `/${input.orgSlug}/live-sessions/${session.id}`;
    const providerSession = isExternal
      ? null
      : await getLiveSessionProvider(liveSessionConfig.provider).createSession({
          sessionId: session.id,
          orgId: session.org_id,
          channelId: session.channel_id,
          scopeKey: session.session_scope_key,
          mode: liveSessionConfig.mode ?? 'video',
        });

    const updateResponse = await input.serviceSupabase
      .from('channel_live_sessions')
      .update({
        provider_session_id: providerSession?.providerSessionId ?? null,
        provider_metadata: providerSession?.providerMetadata ?? {},
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
        await insertParticipantEvent({
          supabase: input.serviceSupabase,
          orgId: session.org_id,
          channelId: session.channel_id,
          liveSessionId: session.id,
          provider: liveSessionConfig.provider,
          eventType: 'session_started',
          profileId: profile.id,
          payload: {
            external: isExternal,
            occurrenceKey: resolved.occurrenceKey,
          },
          normalizedEventVersion: 'v1',
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
            external: isExternal,
            occurrenceKey: resolved.occurrenceKey,
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
      occurrence: availability.occurrence,
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

async function findActiveSessionForScopeKeys(
  supabase: SupabaseServiceClient,
  orgId: string,
  scopeKeys: string[],
) {
  for (const scopeKey of scopeKeys) {
    const response = await getActiveLiveSession(supabase, orgId, scopeKey);
    if (response.error) {
      throw new Error(response.error.message);
    }
    if (response.data) {
      return response.data;
    }
  }

  return null;
}

// ─── Batch join availability over a date range (issue #195) ──────────────────

type OccurrenceCandidate = {
  scheduleId: string;
  occurrenceKey: string;
  channelId: string;
  learningSpaceId: string | null;
  effectiveStartAt: string;
  effectiveEndAt: string;
  isCancelled: boolean;
};

async function loadMembershipChannelIds(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelIds: string[],
  profileIds: string[],
) {
  if (!channelIds.length || !profileIds.length) {
    return new Set<string>();
  }

  const response = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .in('profile_id', profileIds)
    .is('deleted_at', null)
    .returns<Array<{ channel_id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Set((response.data ?? []).map((row) => row.channel_id));
}

async function loadParticipatingScheduleIds(
  supabase: SupabaseServiceClient,
  orgId: string,
  scheduleIds: string[],
  profileIds: string[],
) {
  if (!scheduleIds.length || !profileIds.length) {
    return new Set<string>();
  }

  const response = await supabase
    .from('class_schedule_participants')
    .select('schedule_id')
    .eq('org_id', orgId)
    .in('schedule_id', scheduleIds)
    .in('profile_id', profileIds)
    .is('deleted_at', null)
    .returns<Array<{ schedule_id: string }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Set((response.data ?? []).map((row) => row.schedule_id));
}

async function loadArchivedLearningSpaceIds(
  supabase: SupabaseServiceClient,
  orgId: string,
  learningSpaceIds: string[],
) {
  if (!learningSpaceIds.length) {
    return new Set<string>();
  }

  const response = await supabase
    .from('learning_spaces')
    .select('id, status, archived_at')
    .eq('org_id', orgId)
    .in('id', learningSpaceIds)
    .is('deleted_at', null)
    .returns<Array<{ id: string; status: string | null; archived_at: string | null }>>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return new Set(
    (response.data ?? [])
      .filter((row) => row.archived_at || row.status === 'archived')
      .map((row) => row.id),
  );
}

async function loadLiveSessionConfigsByChannelId(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelIds: string[],
) {
  const configs = new Map<string, ChannelLiveSessionConfigRecord>();
  if (!channelIds.length) {
    return configs;
  }

  const response = await supabase
    .from('channels')
    .select('id, live_session_config')
    .eq('org_id', orgId)
    .in('id', channelIds)
    .is('deleted_at', null)
    .returns<
      Array<{ id: string; live_session_config: Record<string, unknown> | null }>
    >();

  if (response.error) {
    throw new Error(response.error.message);
  }

  (response.data ?? []).forEach((row) => {
    const config = parseChannelLiveSessionConfig(row.live_session_config);
    if (config) {
      configs.set(row.id, config);
    }
  });

  return configs;
}

/**
 * Join availability for every class-session occurrence in a date range.
 *
 * The dashboard renders many cards at once, so asking per card would be a request
 * storm. Every lookup the single-occurrence path does is batched here into one
 * query each, then each occurrence is decided in memory against exactly the same
 * rules — so a card's rendered state always matches what a join would do.
 */
export async function resolveClassSessionJoinAvailabilityRange(input: {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  profile: ProfileRow;
  fromAt: string;
  toAt: string;
  anyVisibleJoinEnabled: boolean;
  now?: Date;
}): Promise<ClassSessionJoinAvailability[]> {
  const now = input.now ?? new Date();
  const rangeStart = new Date(input.fromAt);
  const rangeEnd = new Date(input.toAt);
  if (!Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime())) {
    return [];
  }

  const schedules = (
    await buildClassSchedulesByOrg(input.serviceSupabase, input.orgId)
  ).filter(
    (schedule) =>
      schedule.source.kind === 'class_session' && Boolean(schedule.source.channelId),
  );
  if (!schedules.length) {
    return [];
  }

  const candidates: OccurrenceCandidate[] = expandRecurringEvents(
    schedules,
    rangeStart,
    rangeEnd,
  ).flatMap((occurrence) => {
    const identity = getClassScheduleOccurrenceIdentity(occurrence);
    const schedule = schedules.find(
      (candidate) => candidate.ids.id === identity.scheduleId,
    );
    if (!schedule || schedule.source.kind !== 'class_session') {
      return [];
    }
    const channelId = schedule.source.channelId;
    if (!channelId) {
      return [];
    }

    return [
      {
        scheduleId: identity.scheduleId,
        occurrenceKey: identity.occurrenceKey,
        channelId,
        learningSpaceId: schedule.source.learningSpaceId || null,
        effectiveStartAt: occurrence.startAt,
        effectiveEndAt: occurrence.endAt,
        isCancelled:
          occurrence.status === 'cancelled' || occurrence.uiState?.disabled === true,
      },
    ];
  });

  if (!candidates.length) {
    return [];
  }

  const authorizedProfileIds = await resolveAuthorizedLiveSessionProfileIds({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    profile: input.profile,
  });
  const channelIds = Array.from(new Set(candidates.map((item) => item.channelId)));
  const scheduleIds = Array.from(new Set(candidates.map((item) => item.scheduleId)));
  const learningSpaceIds = Array.from(
    new Set(
      candidates
        .map((item) => item.learningSpaceId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [memberChannelIds, participatingScheduleIds, archivedSpaceIds, configsByChannel] =
    await Promise.all([
      loadMembershipChannelIds(
        input.serviceSupabase,
        input.orgId,
        channelIds,
        authorizedProfileIds,
      ),
      loadParticipatingScheduleIds(
        input.serviceSupabase,
        input.orgId,
        scheduleIds,
        authorizedProfileIds,
      ),
      loadArchivedLearningSpaceIds(input.serviceSupabase, input.orgId, learningSpaceIds),
      loadLiveSessionConfigsByChannelId(input.serviceSupabase, input.orgId, channelIds),
    ]);

  const isSupervisor = SUPERVISORY_PROFILE_KINDS.has(input.profile.kind);
  const nowMs = now.getTime();

  return candidates.flatMap((candidate) => {
    // Occurrences the actor may not join are omitted rather than returned as
    // `not_authorized`. The candidate list starts as every class session in the
    // organization, so echoing the denied ones back would hand any authenticated
    // member the org's whole timetable — channel ids, schedule ids, and times.
    const isAuthorized =
      memberChannelIds.has(candidate.channelId) ||
      participatingScheduleIds.has(candidate.scheduleId) ||
      isSupervisor;
    if (!isAuthorized) {
      return [];
    }

    const occurrence = {
      orgId: input.orgId,
      channelId: candidate.channelId,
      scheduleId: candidate.scheduleId,
      occurrenceKey: candidate.occurrenceKey,
    };
    const base = {
      occurrence,
      effectiveStartAt: candidate.effectiveStartAt,
      effectiveEndAt: candidate.effectiveEndAt,
    };
    const ineligible = (
      reason: ClassSessionJoinIneligibleReason,
    ): ClassSessionJoinAvailability[] => [
      {
        ...base,
        eligible: false,
        reason,
        action: null,
        provider: null,
      },
    ];

    if (candidate.isCancelled) {
      return ineligible('occurrence_cancelled');
    }
    if (candidate.learningSpaceId && archivedSpaceIds.has(candidate.learningSpaceId)) {
      return ineligible('classroom_archived');
    }

    const liveSessionConfig = configsByChannel.get(candidate.channelId);
    if (!liveSessionConfig) {
      return ineligible('live_sessions_disabled');
    }

    const endedAtMs = new Date(candidate.effectiveEndAt).getTime();
    if (endedAtMs + OCCURRENCE_PAST_GRACE_MS <= nowMs) {
      return ineligible('occurrence_past');
    }

    if (!input.anyVisibleJoinEnabled) {
      const startsAtMs = new Date(candidate.effectiveStartAt).getTime();
      if (startsAtMs - LEGACY_EARLY_JOIN_ALLOWANCE_MS > nowMs) {
        return ineligible('feature_disabled');
      }
    }

    return [
      {
        ...base,
        eligible: true,
        reason: null,
        action:
          liveSessionConfig.provider === 'custom' ? 'open_external' : 'join_integrated',
        provider: liveSessionConfig.provider,
      } satisfies ClassSessionJoinAvailability,
    ];
  });
}

// ─── Nest surface ────────────────────────────────────────────────────────────

/**
 * Evaluate the rollout flag for one actor.
 *
 * The API evaluates the same flag the clients do so a client running ahead of (or
 * behind) the rollout cannot render a Join the endpoint would reject, or vice
 * versa. Authorization never depends on this value — an ineligible actor is denied
 * with the flag on or off.
 */
async function isAnyVisibleJoinEnabledForProfile(profileId: string) {
  try {
    return await evaluateApiBooleanFlag({
      flagKey: apiFeatureFlagKeys.enableAnyVisibleClassSessionJoin,
      distinctId: profileId,
    });
  } catch {
    return false;
  }
}

function toJoinAvailabilityVM(
  availability: ClassSessionJoinAvailability,
): ClassSessionJoinAvailabilityVM {
  return {
    occurrence: availability.occurrence,
    effectiveStartAt: availability.effectiveStartAt,
    effectiveEndAt: availability.effectiveEndAt,
    eligible: availability.eligible,
    action: availability.action,
    provider: availability.provider,
    reason: availability.reason,
  };
}

function toJoinDenialException(reason: ClassSessionJoinIneligibleReason) {
  switch (reason) {
    case 'occurrence_not_found':
      return new NotFoundException('Class session occurrence not found');
    case 'not_authorized':
      return new ForbiddenException('Unauthorized');
    default:
      return new ForbiddenException(reason);
  }
}

@Injectable()
export class LiveSessionsService {
  private createServiceClient(): SupabaseServiceClient {
    return createSupabaseServiceClient();
  }

  /**
   * Server-owned answer to "should this viewer see a Join control for this exact
   * occurrence, and will it work?" Clients render an enabled Join if and only if
   * `eligible` is true, and render nothing otherwise (issue #195).
   */
  async getClassSessionJoinAvailability(input: {
    authUserId: string;
    dto: ClassSessionJoinAvailabilityDto;
  }): Promise<ClassSessionJoinAvailabilityVM> {
    const supabase = this.createServiceClient();
    const actor = await resolveLiveSessionActor({
      supabase,
      authUserId: input.authUserId,
      orgSlug: input.dto.orgSlug,
      orgId: input.dto.orgId,
      actingProfileId: input.dto.actingProfileId,
    });

    const availability = await resolveClassSessionJoinAvailability({
      serviceSupabase: supabase,
      orgId: actor.orgId,
      profile: actor.profile,
      scheduleId: input.dto.scheduleId,
      occurrenceKey: input.dto.occurrenceKey,
      anyVisibleJoinEnabled: await isAnyVisibleJoinEnabledForProfile(actor.profile.id),
    });

    return toJoinAvailabilityVM(availability);
  }

  /**
   * Availability for every occurrence in a range, for surfaces that render many
   * cards at once (dashboard, Sessions tab).
   */
  async listClassSessionJoinAvailability(input: {
    authUserId: string;
    dto: ClassSessionJoinAvailabilityRangeDto;
  }): Promise<ClassSessionJoinAvailabilityVM[]> {
    const supabase = this.createServiceClient();
    const actor = await resolveLiveSessionActor({
      supabase,
      authUserId: input.authUserId,
      orgSlug: input.dto.orgSlug,
      orgId: input.dto.orgId,
      actingProfileId: input.dto.actingProfileId,
    });

    const availability = await resolveClassSessionJoinAvailabilityRange({
      serviceSupabase: supabase,
      orgId: actor.orgId,
      profile: actor.profile,
      fromAt: input.dto.fromAt,
      toAt: input.dto.toAt,
      anyVisibleJoinEnabled: await isAnyVisibleJoinEnabledForProfile(actor.profile.id),
    });

    return availability.map(toJoinAvailabilityVM);
  }

  async joinClassSessionOccurrence(input: {
    authUserId: string;
    dto: JoinClassSessionOccurrenceDto;
  }): Promise<ClassSessionJoinResultVM> {
    const supabase = this.createServiceClient();
    const actor = await resolveLiveSessionActor({
      supabase,
      authUserId: input.authUserId,
      orgSlug: input.dto.orgSlug,
      orgId: input.dto.orgId,
      actingProfileId: input.dto.actingProfileId,
    });

    try {
      const result = await joinClassSessionOccurrence({
        serviceSupabase: supabase,
        orgId: actor.orgId,
        orgSlug: actor.orgSlug,
        profile: actor.profile,
        scheduleId: input.dto.scheduleId,
        occurrenceKey: input.dto.occurrenceKey,
        anyVisibleJoinEnabled: await isAnyVisibleJoinEnabledForProfile(actor.profile.id),
      });

      return {
        sessionId: result.sessionId,
        joinPath: result.joinPath,
        status: result.status,
        created: result.created,
        provider: result.provider,
        occurrence: result.occurrence,
      };
    } catch (error) {
      if (error instanceof ClassSessionJoinDeniedError) {
        throw toJoinDenialException(error.reason);
      }
      throw error;
    }
  }

  /**
   * Channel-scoped join, used by the classroom header where the user is joining
   * "the class that is on right now" rather than a card for a specific date.
   */
  async joinChannelLiveSession(input: {
    authUserId: string;
    channelId: string;
    dto: JoinChannelLiveSessionDto;
  }): Promise<CreateOrJoinLiveSessionResult> {
    const supabase = this.createServiceClient();
    const actor = await resolveLiveSessionActor({
      supabase,
      authUserId: input.authUserId,
      orgSlug: input.dto.orgSlug,
      orgId: input.dto.orgId,
      actingProfileId: input.dto.actingProfileId,
    });

    try {
      return await createOrJoinLiveSession({
        serviceSupabase: supabase,
        actor: {
          authUserId: actor.authUserId,
          account: actor.account,
          profile: actor.profile,
        },
        channelId: input.channelId,
        orgSlug: actor.orgSlug,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw new ForbiddenException('Unauthorized');
      }
      throw error;
    }
  }

  /**
   * Provider join credentials for an already-created room, used by the live-session
   * page. Membership is re-checked here: holding a room URL is not authorization.
   */
  async resolveRoomJoinAccess(input: {
    authUserId: string;
    orgSlug?: string | null;
    orgId?: string | null;
    liveSessionId: string;
    actingProfileId?: string | null;
  }) {
    const supabase = this.createServiceClient();
    const actor = await resolveLiveSessionActor({
      supabase,
      authUserId: input.authUserId,
      orgSlug: input.orgSlug,
      orgId: input.orgId,
      actingProfileId: input.actingProfileId,
    });

    try {
      const { session, joinAccess } = await resolveLiveSessionJoinAccess({
        serviceSupabase: supabase,
        liveSessionId: input.liveSessionId,
        profile: actor.profile,
      });

      if (session.org_id !== actor.orgId) {
        throw new ForbiddenException('Unauthorized');
      }

      return {
        sessionId: session.id,
        channelId: session.channel_id,
        provider: session.provider as LiveSessionProviderVM,
        status: session.status,
        occurrenceKey: session.occurrence_key ?? null,
        joinAccess,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        throw new ForbiddenException('Unauthorized');
      }
      if (error instanceof Error && error.message === 'Live session not found') {
        throw new NotFoundException('Live session not found');
      }
      throw error;
    }
  }
}
