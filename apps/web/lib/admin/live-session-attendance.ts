import type {
  LiveSessionAttendanceDetailVM,
  LiveSessionAttendanceFilterVM,
  LiveSessionAttendanceListItemVM,
} from '@iconicedu/shared-types';

import {
  buildLiveSessionAttendanceDetailVM,
  buildLiveSessionAttendanceListItemVM,
} from '@iconicedu/web/lib/admin/live-session-attendance.builder';
import {
  getLiveSessionAttendanceDetailRows,
  listLiveSessionAttendanceRows,
} from '@iconicedu/web/lib/admin/live-session-attendance.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export async function getAdminLiveSessionAttendanceList(
  orgId: string,
  filters: LiveSessionAttendanceFilterVM = {},
): Promise<LiveSessionAttendanceListItemVM[]> {
  if (!orgId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const rows = await listLiveSessionAttendanceRows(supabase, orgId, filters);

  const channelById = new Map(rows.channels.map((channel) => [channel.id, channel]));
  const learningSpaceLinkByChannelId = new Map(
    rows.learningSpaceLinks.map((link) => [link.channel_id, link]),
  );
  const learningSpaceById = new Map(
    rows.learningSpaces.map((learningSpace) => [learningSpace.id, learningSpace]),
  );
  const participantsBySessionId = new Map<string, typeof rows.participants>();
  rows.participants.forEach((participant) => {
    const bucket = participantsBySessionId.get(participant.live_session_id) ?? [];
    bucket.push(participant);
    participantsBySessionId.set(participant.live_session_id, bucket);
  });
  const profileById = new Map(rows.profiles.map((profile) => [profile.id, profile]));

  return rows.sessions.map((session) => {
    const link = learningSpaceLinkByChannelId.get(session.channel_id) ?? null;
    return buildLiveSessionAttendanceListItemVM({
      session,
      channel: channelById.get(session.channel_id) ?? null,
      learningSpaceLink: link,
      learningSpace: link
        ? (learningSpaceById.get(link.learning_space_id) ?? null)
        : null,
      participants: participantsBySessionId.get(session.id) ?? [],
      starterProfile: profileById.get(session.started_by_profile_id) ?? null,
      profiles: rows.profiles,
    });
  });
}

export async function getAdminLiveSessionAttendanceDetail(
  orgId: string,
  liveSessionId: string,
): Promise<LiveSessionAttendanceDetailVM | null> {
  if (!orgId || !liveSessionId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const rows = await getLiveSessionAttendanceDetailRows(supabase, orgId, liveSessionId);
  if (!rows.session) {
    return null;
  }

  return buildLiveSessionAttendanceDetailVM({
    session: rows.session,
    channel: rows.channel,
    learningSpaceLink: rows.learningSpaceLink,
    learningSpace: rows.learningSpace,
    participants: rows.participants,
    events: rows.events,
    profiles: rows.profiles,
    starterProfile: rows.starterProfile,
  });
}

export type LiveSessionQualityEventRow = {
  id: string;
  display_name: string;
  metric: 'network_quality' | 'connection_state';
  level: string;
  occurred_at: string;
};

// Deliberately kept as a standalone read next to the detail VM above rather
// than threaded through buildLiveSessionAttendanceDetailVM/its VM type — this
// is a small, independent addition (FR-043: staff identifying rooms with
// media problems) and the existing builder already has solid test coverage
// that a new required field would put at risk for no real benefit here.
export async function getAdminLiveSessionQualityEvents(
  orgId: string,
  liveSessionId: string,
): Promise<LiveSessionQualityEventRow[]> {
  if (!orgId || !liveSessionId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const response = await supabase
    .from('channel_live_session_quality_events')
    .select('id, display_name, metric, level, occurred_at')
    .eq('org_id', orgId)
    .eq('live_session_id', liveSessionId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .returns<LiveSessionQualityEventRow[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? [];
}
