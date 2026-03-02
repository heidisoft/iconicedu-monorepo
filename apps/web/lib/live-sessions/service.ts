import type { LiveSessionModeVM, LiveSessionProviderVM, ProfileRow } from '@iconicedu/shared-types';

import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getLiveSessionProvider } from '@iconicedu/web/lib/live-sessions/providers';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

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
  provider_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

type ChannelSummaryRow = {
  id: string;
  org_id: string;
  kind: string;
  topic: string;
  purpose: string;
  live_session_config?: Record<string, unknown> | null;
};

export type CreateOrJoinLiveSessionResult = {
  sessionId: string;
  joinPath: string;
  status: ChannelLiveSessionRowRecord['status'];
  created: boolean;
  provider: LiveSessionProviderVM;
};

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
  last_known_status: 'requested' | 'joined' | 'left';
  provider_participant_id?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

function parseChannelLiveSessionConfig(value: unknown): ChannelLiveSessionConfigRecord | null {
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
    mode: candidate.mode === 'audio' || candidate.mode === 'video' ? candidate.mode : null,
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
    .select('id, org_id, kind, topic, purpose, live_session_config')
    .eq('org_id', orgId)
    .eq('id', channelId)
    .is('deleted_at', null)
    .maybeSingle<ChannelSummaryRow>();
}

async function verifyChannelMembership(
  supabase: SupabaseServiceClient,
  orgId: string,
  channelId: string,
  profileId: string,
) {
  const response = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  return Boolean(response.data?.id);
}

async function findSystemProfileId(supabase: SupabaseServiceClient, orgId: string) {
  const response = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .eq('kind', 'system')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return response.data?.id ?? null;
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
  providerParticipantId?: string | null;
  providerEventId?: string | null;
  occurredAt?: string;
  source?: 'app' | 'provider_webhook';
}) {
  const response = await input.supabase.from('channel_live_session_participant_events').insert({
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
    payload: input.payload,
  });

  if (response.error) {
    if (input.providerEventId && response.error.code === '23505') {
      return;
    }
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
        join_requested_at: input.eventType === 'participant_joined' ? input.occurredAt : null,
        first_joined_at: input.eventType === 'participant_joined' ? input.occurredAt : null,
        last_joined_at: input.eventType === 'participant_joined' ? input.occurredAt : null,
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
    provider_participant_id: input.providerParticipantId ?? existing.provider_participant_id ?? null,
    provider_metadata: {
      ...(existing.provider_metadata ?? {}),
      ...(input.providerMetadata ?? {}),
    },
    updated_at: new Date().toISOString(),
  };

  if (input.eventType === 'participant_joined') {
    const nextJoinCount =
      existing.last_known_status === 'joined' ? existing.join_count : existing.join_count + 1;
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

async function insertLiveSessionStartedMessage(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  actorProfileId: string;
  actorDisplayName: string;
  title: string;
  joinUrl: string;
  provider: LiveSessionProviderVM;
  sessionId: string;
  occurrenceKey?: string | null;
  occurrenceLabel?: string | null;
}) {
  const now = new Date().toISOString();
  const messageResponse = await input.supabase
    .from('messages')
    .insert({
      org_id: input.orgId,
      channel_id: input.channelId,
      sender_profile_id: input.senderProfileId,
      type: 'live-session-started',
      visibility_type: 'all',
      created_by: input.actorProfileId,
      updated_by: input.actorProfileId,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single<{ id: string }>();

  if (messageResponse.error) {
    throw new Error(messageResponse.error.message);
  }

  const payloadResponse = await input.supabase
    .from('message_live_session_started')
    .insert({
      message_id: messageResponse.data.id,
      org_id: input.orgId,
      payload: {
        sessionId: input.sessionId,
        provider: input.provider,
        title: input.title,
        joinUrl: input.joinUrl,
        startedByProfileId: input.actorProfileId,
        startedByDisplayName: input.actorDisplayName,
        startedAt: now,
        occurrenceKey: input.occurrenceKey ?? null,
        occurrenceLabel: input.occurrenceLabel ?? null,
        status: 'live',
      },
      created_by: input.actorProfileId,
      updated_by: input.actorProfileId,
      created_at: now,
      updated_at: now,
    });

  if (payloadResponse.error) {
    throw new Error(payloadResponse.error.message);
  }

  return messageResponse.data.id;
}

export async function createOrJoinLiveSession(input: {
  supabase: SupabaseServerClient;
  serviceSupabase: SupabaseServiceClient;
  authUserId: string;
  channelId: string;
  orgSlug: string;
}): Promise<CreateOrJoinLiveSessionResult> {
  const [accountResponse] = await Promise.all([
    getAccountByAuthUserId(input.supabase, input.authUserId),
  ]);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(input.supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  const channelResponse = await getChannelSummary(
    input.serviceSupabase,
    accountResponse.data.org_id,
    input.channelId,
  );
  if (!channelResponse.data) {
    throw new Error('Channel not found');
  }

  const hasMembership = await verifyChannelMembership(
    input.serviceSupabase,
    channelResponse.data.org_id,
    channelResponse.data.id,
    profileResponse.data.id,
  );
  if (!hasMembership) {
    throw new Error('Unauthorized');
  }

  const liveSessionConfig = parseChannelLiveSessionConfig(
    channelResponse.data.live_session_config,
  );
  if (!liveSessionConfig) {
    throw new Error('Live sessions are not enabled for this channel');
  }

  if (liveSessionConfig.provider === 'custom') {
    if (!liveSessionConfig.joinUrl) {
      throw new Error('Custom live session join URL is missing');
    }

    return {
      sessionId: `external:${channelResponse.data.id}`,
      joinPath: liveSessionConfig.joinUrl,
      status: 'live',
      created: false,
      provider: liveSessionConfig.provider,
    };
  }

  const scope = await resolveChannelLiveSessionScope({
    supabase: input.serviceSupabase,
    orgId: channelResponse.data.org_id,
    channelId: channelResponse.data.id,
  });

  const activeSessionResponse = await getActiveLiveSession(
    input.serviceSupabase,
    channelResponse.data.org_id,
    scope.scopeKey,
  );
  if (activeSessionResponse.error) {
    throw new Error(activeSessionResponse.error.message);
  }

  const existingSession = activeSessionResponse.data ?? null;
  if (existingSession) {
    await upsertJoinRequestedParticipant({
      supabase: input.serviceSupabase,
      session: existingSession,
      profileId: profileResponse.data.id,
    });
    await insertParticipantEvent({
      supabase: input.serviceSupabase,
      orgId: existingSession.org_id,
      channelId: existingSession.channel_id,
      liveSessionId: existingSession.id,
      provider: existingSession.provider as LiveSessionProviderVM,
      eventType: 'join_requested',
      profileId: profileResponse.data.id,
      payload: {
        reused: true,
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

  const now = new Date().toISOString();
  const joinPath = `/${input.orgSlug}/live-sessions/temp`;
  const insertResponse = await input.serviceSupabase
    .from('channel_live_sessions')
    .insert({
      org_id: channelResponse.data.org_id,
      channel_id: channelResponse.data.id,
      provider: liveSessionConfig.provider,
      session_scope_key: scope.scopeKey,
      occurrence_key: scope.occurrenceKey ?? null,
      status: 'starting',
      started_by_profile_id: profileResponse.data.id,
      join_path: joinPath,
      started_at: now,
      created_at: now,
      updated_at: now,
      created_by: profileResponse.data.id,
      updated_by: profileResponse.data.id,
    })
    .select('*')
    .single<ChannelLiveSessionRowRecord>();

  if (insertResponse.error) {
    const fallbackSessionResponse = await getActiveLiveSession(
      input.serviceSupabase,
      channelResponse.data.org_id,
      scope.scopeKey,
    );
    if (fallbackSessionResponse.data) {
      await upsertJoinRequestedParticipant({
        supabase: input.serviceSupabase,
        session: fallbackSessionResponse.data,
        profileId: profileResponse.data.id,
      });
      await insertParticipantEvent({
        supabase: input.serviceSupabase,
        orgId: fallbackSessionResponse.data.org_id,
        channelId: fallbackSessionResponse.data.channel_id,
        liveSessionId: fallbackSessionResponse.data.id,
        provider: fallbackSessionResponse.data.provider as LiveSessionProviderVM,
        eventType: 'join_requested',
        profileId: profileResponse.data.id,
        payload: {
          reused: true,
          source: 'insert-conflict',
        },
      });
      return {
        sessionId: fallbackSessionResponse.data.id,
        joinPath: fallbackSessionResponse.data.join_path,
        status: fallbackSessionResponse.data.status,
        created: false,
        provider: fallbackSessionResponse.data.provider as LiveSessionProviderVM,
      };
    }
    throw new Error(insertResponse.error.message);
  }

  const session = insertResponse.data;
  const provider = getLiveSessionProvider(liveSessionConfig.provider);

  try {
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
        updated_by: profileResponse.data.id,
      })
      .eq('id', session.id)
      .eq('org_id', session.org_id)
      .select('*')
      .single<ChannelLiveSessionRowRecord>();

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message);
    }

    const messageSenderProfileId =
      (await findSystemProfileId(input.serviceSupabase, session.org_id)) ?? profileResponse.data.id;
    const title =
      channelResponse.data.purpose === 'learning-space'
        ? 'Class started'
        : 'Live session started';
    const startedMessageId = await insertLiveSessionStartedMessage({
      supabase: input.serviceSupabase,
      orgId: session.org_id,
      channelId: session.channel_id,
      senderProfileId: messageSenderProfileId,
      actorProfileId: profileResponse.data.id,
      actorDisplayName:
        profileResponse.data.display_name ??
        ([profileResponse.data.first_name, profileResponse.data.last_name]
          .filter(Boolean)
          .join(' ') || 'User'),
      title,
      joinUrl: resolvedJoinPath,
      provider: liveSessionConfig.provider,
      sessionId: session.id,
      occurrenceKey: scope.occurrenceKey ?? null,
      occurrenceLabel: scope.occurrenceLabel ?? null,
    });

    await input.serviceSupabase
      .from('channel_live_sessions')
      .update({
        started_message_id: startedMessageId,
        updated_at: new Date().toISOString(),
        updated_by: profileResponse.data.id,
      })
      .eq('id', session.id)
      .eq('org_id', session.org_id);

    await upsertJoinRequestedParticipant({
      supabase: input.serviceSupabase,
      session: updateResponse.data,
      profileId: profileResponse.data.id,
    });
    await insertParticipantEvent({
      supabase: input.serviceSupabase,
      orgId: session.org_id,
      channelId: session.channel_id,
      liveSessionId: session.id,
      provider: liveSessionConfig.provider,
      eventType: 'session_started',
      profileId: profileResponse.data.id,
      payload: {
        startedMessageId,
      },
    });
    await insertParticipantEvent({
      supabase: input.serviceSupabase,
      orgId: session.org_id,
      channelId: session.channel_id,
      liveSessionId: session.id,
      provider: liveSessionConfig.provider,
      eventType: 'join_requested',
      profileId: profileResponse.data.id,
      payload: {
        created: true,
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
        updated_by: profileResponse.data.id,
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
  const sessionResponse = await getLiveSessionById(input.serviceSupabase, input.liveSessionId);
  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message);
  }
  if (!sessionResponse.data) {
    throw new Error('Live session not found');
  }
  if (sessionResponse.data.status !== 'live') {
    throw new Error('Live session is not active');
  }

  const hasMembership = await verifyChannelMembership(
    input.serviceSupabase,
    sessionResponse.data.org_id,
    sessionResponse.data.channel_id,
    input.profile.id,
  );
  if (!hasMembership) {
    throw new Error('Unauthorized');
  }

  const provider = getLiveSessionProvider(sessionResponse.data.provider as LiveSessionProviderVM);
  const displayName =
    input.profile.display_name ??
    ([input.profile.first_name, input.profile.last_name].filter(Boolean).join(' ') || 'User');
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
        .eq('org_id', session.org_id);

      if (updateResponse.error) {
        throw new Error(updateResponse.error.message);
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
    }
  }

  return { processed: events.length };
}
