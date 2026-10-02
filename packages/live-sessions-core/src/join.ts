import type {
  LiveSessionModeVM,
  LiveSessionProviderVM,
  ProfileRow,
} from '@iconicedu/shared-types';

import { getLiveSessionProvider } from './providers';
import { getWebAppUrl } from './web-app-url';

function buildZoomJoinUrl(
  sessionId: string,
  providerMetadata: Record<string, unknown> | undefined,
): string {
  const url = new URL(`/live/${sessionId}`, getWebAppUrl());
  const passcode = providerMetadata?.passcode;
  if (typeof passcode === 'string' && passcode) {
    url.searchParams.set('passcode', passcode);
  }
  return url.toString();
}
import {
  snapshotExpectedParticipantsForLiveSession,
  getLiveSessionAttendancePolicy,
} from './expected-participants';
import { resolveChannelLiveSessionScope } from './scope';
import type { LiveSessionSupabaseClient } from './types';

type ChannelLiveSessionConfigRecord = {
  enabled: boolean;
  provider: LiveSessionProviderVM;
  mode?: LiveSessionModeVM | null;
  joinUrl?: string | null;
};

export type ChannelLiveSessionRowRecord = {
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

export type PostJoinSideEffectErrorInfo = {
  error: unknown;
  channelId: string;
  sessionId: string;
  profileId: string;
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
  supabase: LiveSessionSupabaseClient,
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

/**
 * Org owners/admins/staff can join or monitor any live session in their org
 * even when they aren't an explicit channel member — mirrors
 * apps/api's channels.service.ts hasRosterReadRole, which grants the same
 * org-role-based bypass for viewing a channel's roster.
 */
async function hasOrgStaffRole(
  supabase: LiveSessionSupabaseClient,
  orgId: string,
  profileIds: string[],
): Promise<boolean> {
  if (!profileIds.length) {
    return false;
  }

  const profilesResponse = await supabase
    .from('profiles')
    .select('account_id, kind')
    .eq('org_id', orgId)
    .in('id', profileIds)
    .is('deleted_at', null)
    .returns<Array<{ account_id: string | null; kind: string | null }>>();
  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  const rows = profilesResponse.data ?? [];
  if (rows.some((row) => row.kind === 'staff')) {
    return true;
  }

  const accountIds = Array.from(
    new Set(rows.map((row) => row.account_id).filter((id): id is string => Boolean(id))),
  );
  if (!accountIds.length) {
    return false;
  }

  const [roleResponse, accountResponse] = await Promise.all([
    supabase
      .from('user_roles')
      .select('id')
      .eq('org_id', orgId)
      .in('account_id', accountIds)
      .in('role_key', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .limit(1)
      .returns<Array<{ id: string }>>(),
    supabase
      .from('accounts')
      .select('id')
      .in('id', accountIds)
      .eq('org_id', orgId)
      .in('primary_role', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .limit(1)
      .returns<Array<{ id: string }>>(),
  ]);
  if (roleResponse.error) {
    throw new Error(roleResponse.error.message);
  }
  if (accountResponse.error) {
    throw new Error(accountResponse.error.message);
  }

  return Boolean(roleResponse.data?.[0]?.id || accountResponse.data?.[0]?.id);
}

export async function verifyChannelMembership(
  supabase: LiveSessionSupabaseClient,
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

  if (response.data?.[0]?.id) {
    return true;
  }

  return hasOrgStaffRole(supabase, orgId, profileIds);
}

async function assertLearningSpaceIsActionable(input: {
  supabase: LiveSessionSupabaseClient;
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

export async function resolveAuthorizedLiveSessionProfileIds(input: {
  supabase: LiveSessionSupabaseClient;
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

function runPostJoinSideEffects(
  scheduler: PostJoinSideEffectsScheduler | undefined,
  onError: ((info: PostJoinSideEffectErrorInfo) => void) | undefined,
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
      onError?.({
        error,
        channelId: input.channelId,
        sessionId: input.sessionId,
        profileId: input.profileId,
      });
    }
  });
}

async function getActiveLiveSession(
  supabase: LiveSessionSupabaseClient,
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
  supabase: LiveSessionSupabaseClient;
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

export async function insertParticipantEvent(input: {
  supabase: LiveSessionSupabaseClient;
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
  serviceSupabase: LiveSessionSupabaseClient;
  actor: {
    authUserId: string;
    account: { id: string; org_id: string };
    profile: ProfileRow;
  };
  channelId: string;
  orgSlug: string;
  schedulePostJoinSideEffects?: PostJoinSideEffectsScheduler;
  onPostJoinSideEffectError?: (info: PostJoinSideEffectErrorInfo) => void;
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
  let existingSession = activeSessionResponse.data ?? null;

  if (existingSession && existingSession.provider !== liveSessionConfig.provider) {
    // The channel's configured provider changed after this session started —
    // reusing it would silently hand back a stale link for a provider the
    // channel no longer uses. End it so a fresh session is created below
    // under the current config instead. Safe: the active-scope unique index
    // (channel_live_sessions_active_scope_idx) only blocks a second
    // starting/live row for this scope, not a new one once this is 'ended'.
    const endStaleSessionResponse = await input.serviceSupabase
      .from('channel_live_sessions')
      .update({
        status: 'ended',
        ended_at: now,
        updated_at: now,
        updated_by: profile.id,
      })
      .eq('id', existingSession.id)
      .eq('org_id', existingSession.org_id);
    if (endStaleSessionResponse.error) {
      throw new Error(endStaleSessionResponse.error.message);
    }
    existingSession = null;
  }

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
    runPostJoinSideEffects(
      input.schedulePostJoinSideEffects,
      input.onPostJoinSideEffectError,
      {
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
      },
    );

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
      runPostJoinSideEffects(
        input.schedulePostJoinSideEffects,
        input.onPostJoinSideEffectError,
        {
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
        },
      );
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
      runPostJoinSideEffects(
        input.schedulePostJoinSideEffects,
        input.onPostJoinSideEffectError,
        {
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
                external: true,
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
                external: true,
              },
              normalizedEventVersion: 'v1',
            });
          },
        },
      );

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

    // Zoom's join_path is a full shareable URL to a public landing page rather
    // than a path relative to the app — this is what makes the client show it
    // through the same "Session ready to join" copy-link popup used for
    // external/custom providers (isExternalJoinHref just checks for http(s)://),
    // instead of silently navigating straight into an embedded room. The
    // passcode travels in the URL for members so clicking "Open Zoom" joins
    // immediately; anyone the member shares this link with can join too (the
    // public guest-join endpoint is the real access boundary, not the URL
    // itself), and anyone who only has the bare URL enters it manually.
    const resolvedJoinPath =
      liveSessionConfig.provider === 'zoom'
        ? buildZoomJoinUrl(session.id, providerSession.providerMetadata)
        : `/${input.orgSlug}/live-sessions/${session.id}`;
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
    runPostJoinSideEffects(
      input.schedulePostJoinSideEffects,
      input.onPostJoinSideEffectError,
      {
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
            payload: {},
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
            },
            normalizedEventVersion: 'v1',
          });
        },
      },
    );

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
