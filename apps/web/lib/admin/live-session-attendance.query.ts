import type {
  ChannelLiveSessionParticipantEventRow,
  ChannelLiveSessionParticipantRow,
  ChannelLiveSessionRow,
  ChannelRow,
  LearningSpaceChannelRow,
  LearningSpaceRow,
  ProfileRow,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

export type LiveSessionAttendanceQueryFilters = {
  channelId?: string | null;
  learningSpaceId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: 'starting' | 'live' | 'ended' | 'failed' | null;
};

export type LiveSessionAttendanceListRows = {
  sessions: ChannelLiveSessionRow[];
  channels: ChannelRow[];
  learningSpaceLinks: LearningSpaceChannelRow[];
  learningSpaces: LearningSpaceRow[];
  participants: ChannelLiveSessionParticipantRow[];
  profiles: ProfileRow[];
};

export type LiveSessionAttendanceDetailRows = {
  session: ChannelLiveSessionRow | null;
  channel: ChannelRow | null;
  learningSpaceLink: LearningSpaceChannelRow | null;
  learningSpace: LearningSpaceRow | null;
  participants: ChannelLiveSessionParticipantRow[];
  events: ChannelLiveSessionParticipantEventRow[];
  profiles: ProfileRow[];
  starterProfile: ProfileRow | null;
};

async function getLearningSpaceLinksByChannelIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as LearningSpaceChannelRow[], error: null };
  }

  return supabase
    .from('learning_space_channels')
    .select('*')
    .eq('org_id', orgId)
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .returns<LearningSpaceChannelRow[]>();
}

async function getLearningSpacesByIds(
  supabase: SupabaseClient,
  orgId: string,
  learningSpaceIds: string[],
) {
  if (!learningSpaceIds.length) {
    return { data: [] as LearningSpaceRow[], error: null };
  }

  return supabase
    .from('learning_spaces')
    .select('*')
    .eq('org_id', orgId)
    .in('id', learningSpaceIds)
    .is('deleted_at', null)
    .returns<LearningSpaceRow[]>();
}

async function getChannelsByIds(
  supabase: SupabaseClient,
  orgId: string,
  channelIds: string[],
) {
  if (!channelIds.length) {
    return { data: [] as ChannelRow[], error: null };
  }

  return supabase
    .from('channels')
    .select('*')
    .eq('org_id', orgId)
    .in('id', channelIds)
    .is('deleted_at', null)
    .returns<ChannelRow[]>();
}

async function getLiveSessionParticipantsBySessionIds(
  supabase: SupabaseClient,
  orgId: string,
  liveSessionIds: string[],
) {
  if (!liveSessionIds.length) {
    return { data: [] as ChannelLiveSessionParticipantRow[], error: null };
  }

  return supabase
    .from('channel_live_session_participants')
    .select('*')
    .eq('org_id', orgId)
    .in('live_session_id', liveSessionIds)
    .is('deleted_at', null)
    .returns<ChannelLiveSessionParticipantRow[]>();
}

export async function listLiveSessionAttendanceRows(
  supabase: SupabaseClient,
  orgId: string,
  filters: LiveSessionAttendanceQueryFilters = {},
): Promise<LiveSessionAttendanceListRows> {
  let query = supabase
    .from('channel_live_sessions')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('started_at', { ascending: false });

  if (filters.channelId) {
    query = query.eq('channel_id', filters.channelId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('started_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('started_at', filters.dateTo);
  }

  const sessionResponse = await query.returns<ChannelLiveSessionRow[]>();
  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message);
  }

  const sessions = sessionResponse.data ?? [];
  const channelIds = Array.from(new Set(sessions.map((row) => row.channel_id)));
  const [channelsResponse, linksResponse, participantsResponse] = await Promise.all([
    getChannelsByIds(supabase, orgId, channelIds),
    getLearningSpaceLinksByChannelIds(supabase, orgId, channelIds),
    getLiveSessionParticipantsBySessionIds(
      supabase,
      orgId,
      sessions.map((row) => row.id),
    ),
  ]);

  if (channelsResponse.error) {
    throw new Error(channelsResponse.error.message);
  }
  if (linksResponse.error) {
    throw new Error(linksResponse.error.message);
  }
  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }

  const channels = channelsResponse.data ?? [];
  const learningSpaceLinks = linksResponse.data ?? [];
  const participants = participantsResponse.data ?? [];

  const learningSpaceIds = Array.from(
    new Set(
      learningSpaceLinks
        .map((row) => row.learning_space_id)
        .filter((learningSpaceId) => !filters.learningSpaceId || learningSpaceId === filters.learningSpaceId),
    ),
  );

  const filteredChannelIds = filters.learningSpaceId
    ? new Set(
        learningSpaceLinks
          .filter((row) => row.learning_space_id === filters.learningSpaceId)
          .map((row) => row.channel_id),
      )
    : null;

  const filteredSessions = filteredChannelIds
    ? sessions.filter((row) => filteredChannelIds.has(row.channel_id))
    : sessions;

  const filteredParticipants = new Set(filteredSessions.map((row) => row.id));
  const scopedParticipants = participants.filter((row) => filteredParticipants.has(row.live_session_id));

  const [learningSpacesResponse, profilesResponse] = await Promise.all([
    getLearningSpacesByIds(supabase, orgId, learningSpaceIds),
    getProfilesByIds(
      supabase,
      orgId,
      Array.from(
        new Set([
          ...filteredSessions.map((row) => row.started_by_profile_id),
          ...scopedParticipants.map((row) => row.profile_id),
        ]),
      ),
    ),
  ]);

  if (learningSpacesResponse.error) {
    throw new Error(learningSpacesResponse.error.message);
  }
  if ('error' in profilesResponse && profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  return {
    sessions: filteredSessions,
    channels,
    learningSpaceLinks,
    learningSpaces: learningSpacesResponse.data ?? [],
    participants: scopedParticipants,
    profiles: profilesResponse.data ?? [],
  };
}

export async function getLiveSessionAttendanceDetailRows(
  supabase: SupabaseClient,
  orgId: string,
  liveSessionId: string,
): Promise<LiveSessionAttendanceDetailRows> {
  const sessionResponse = await supabase
    .from('channel_live_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', liveSessionId)
    .is('deleted_at', null)
    .maybeSingle<ChannelLiveSessionRow>();

  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message);
  }

  const session = sessionResponse.data ?? null;
  if (!session) {
    return {
      session: null,
      channel: null,
      learningSpaceLink: null,
      learningSpace: null,
      participants: [],
      events: [],
      profiles: [],
      starterProfile: null,
    };
  }

  const [channelResponse, linkResponse, participantsResponse, eventsResponse] = await Promise.all([
    supabase
      .from('channels')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', session.channel_id)
      .is('deleted_at', null)
      .maybeSingle<ChannelRow>(),
    supabase
      .from('learning_space_channels')
      .select('*')
      .eq('org_id', orgId)
      .eq('channel_id', session.channel_id)
      .is('deleted_at', null)
      .maybeSingle<LearningSpaceChannelRow>(),
    supabase
      .from('channel_live_session_participants')
      .select('*')
      .eq('org_id', orgId)
      .eq('live_session_id', liveSessionId)
      .is('deleted_at', null)
      .returns<ChannelLiveSessionParticipantRow[]>(),
    supabase
      .from('channel_live_session_participant_events')
      .select('*')
      .eq('org_id', orgId)
      .eq('live_session_id', liveSessionId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: true })
      .returns<ChannelLiveSessionParticipantEventRow[]>(),
  ]);

  if (channelResponse.error) {
    throw new Error(channelResponse.error.message);
  }
  if (linkResponse.error) {
    throw new Error(linkResponse.error.message);
  }
  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }
  if (eventsResponse.error) {
    throw new Error(eventsResponse.error.message);
  }

  const learningSpaceLink = linkResponse.data ?? null;
  const participants = participantsResponse.data ?? [];
  const events = eventsResponse.data ?? [];
  const [learningSpaceResponse, profilesResponse] = await Promise.all([
    learningSpaceLink
      ? supabase
          .from('learning_spaces')
          .select('*')
          .eq('org_id', orgId)
          .eq('id', learningSpaceLink.learning_space_id)
          .is('deleted_at', null)
          .maybeSingle<LearningSpaceRow>()
      : Promise.resolve({ data: null, error: null }),
    getProfilesByIds(
      supabase,
      orgId,
      Array.from(
        new Set([
          session.started_by_profile_id,
          ...participants.map((row) => row.profile_id),
          ...events
            .map((row) => row.profile_id)
            .filter((profileId): profileId is string => Boolean(profileId)),
        ]),
      ),
    ),
  ]);

  if (learningSpaceResponse.error) {
    throw new Error(learningSpaceResponse.error.message);
  }
  if ('error' in profilesResponse && profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  const profiles = profilesResponse.data ?? [];

  return {
    session,
    channel: channelResponse.data ?? null,
    learningSpaceLink,
    learningSpace: learningSpaceResponse.data ?? null,
    participants,
    events,
    profiles,
    starterProfile: profiles.find((profile) => profile.id === session.started_by_profile_id) ?? null,
  };
}

export async function listLiveSessionAttendanceParticipantsWithOutcomes(
  supabase: SupabaseClient,
  orgId: string,
  liveSessionId: string,
) {
  const response = await supabase
    .from('channel_live_session_participants')
    .select('*')
    .eq('org_id', orgId)
    .eq('live_session_id', liveSessionId)
    .is('deleted_at', null)
    .returns<ChannelLiveSessionParticipantRow[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? [];
}

export async function getLiveSessionAttendanceTimeline(
  supabase: SupabaseClient,
  orgId: string,
  liveSessionId: string,
) {
  const response = await supabase
    .from('channel_live_session_participant_events')
    .select('*')
    .eq('org_id', orgId)
    .eq('live_session_id', liveSessionId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: true })
    .returns<ChannelLiveSessionParticipantEventRow[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? [];
}
