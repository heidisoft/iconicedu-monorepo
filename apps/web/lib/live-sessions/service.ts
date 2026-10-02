import type { LiveSessionProviderVM, ProfileRow } from '@iconicedu/shared-types';

import {
  getLiveSessionProvider,
  insertParticipantEvent,
  resolveAuthorizedLiveSessionProfileIds,
  verifyChannelMembership,
} from '@iconicedu/live-sessions-core';
import {
  evaluateLiveSessionAttendance,
  regenerateLiveSessionAttendanceReport,
} from '@iconicedu/web/lib/live-sessions/attendance-evaluator';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

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
    isHost: input.profile.id === sessionResponse.data.started_by_profile_id,
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

export { evaluateLiveSessionAttendance, regenerateLiveSessionAttendanceReport };
