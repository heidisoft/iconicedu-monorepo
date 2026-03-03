import type {
  ChannelLiveSessionExpectedParticipantRow,
  ChannelLiveSessionParticipantRow,
  ChannelLiveSessionRow,
} from '@iconicedu/shared-types';

import {
  getLiveSessionAttendancePolicy,
  __test__ as expectedParticipantsTest,
} from '@iconicedu/web/lib/live-sessions/expected-participants';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

const ATTENDANCE_EVALUATION_VERSION = 'v1';

type AttendanceStatus =
  | 'expected'
  | 'attended'
  | 'partial'
  | 'full'
  | 'no_show'
  | 'excused';

type EvaluatedParticipant = {
  participantId: string;
  creditedSeconds: number;
  requiredSeconds: number | null;
  attendanceRatio: number | null;
  attended: boolean;
  expectedToAttend: boolean;
  qualifiedFullAttendance: boolean;
  attendanceStatus: AttendanceStatus;
  evaluationReason: string | null;
};

function calculateSessionDurationSeconds(session: ChannelLiveSessionRow): number | null {
  if (!session.started_at || !session.ended_at) {
    return null;
  }

  const startedAt = new Date(session.started_at).getTime();
  const endedAt = new Date(session.ended_at).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return null;
  }

  return Math.round((endedAt - startedAt) / 1000);
}

function calculateScheduledDurationSeconds(session: ChannelLiveSessionRow): number | null {
  const occurrenceStart = session.occurrence_key ? new Date(session.occurrence_key).getTime() : NaN;
  const occurrenceEndRaw =
    session.app_metadata && typeof session.app_metadata.occurrenceEndAt === 'string'
      ? session.app_metadata.occurrenceEndAt
      : null;
  const occurrenceEnd = occurrenceEndRaw ? new Date(occurrenceEndRaw).getTime() : NaN;
  if (!Number.isFinite(occurrenceStart) || !Number.isFinite(occurrenceEnd) || occurrenceEnd < occurrenceStart) {
    return null;
  }

  return Math.round((occurrenceEnd - occurrenceStart) / 1000);
}

function calculateRequiredSeconds(session: ChannelLiveSessionRow): number | null {
  const actualDurationSeconds = calculateSessionDurationSeconds(session);
  if (session.occurrence_key) {
    const scheduledDurationSeconds = calculateScheduledDurationSeconds(session);
    if (scheduledDurationSeconds === null) {
      return actualDurationSeconds;
    }
    if (actualDurationSeconds === null) {
      return scheduledDurationSeconds;
    }
    return Math.min(scheduledDurationSeconds, actualDurationSeconds);
  }

  return actualDurationSeconds;
}

function calculateCreditedSeconds(
  participant: ChannelLiveSessionParticipantRow,
  session: ChannelLiveSessionRow,
): number {
  const creditedSeconds = participant.credited_seconds ?? participant.total_seconds ?? 0;

  if (
    participant.last_known_status === 'joined' &&
    participant.last_joined_at &&
    session.ended_at
  ) {
    const joinedAt = new Date(participant.last_joined_at).getTime();
    const endedAt = new Date(session.ended_at).getTime();
    if (Number.isFinite(joinedAt) && Number.isFinite(endedAt) && endedAt >= joinedAt) {
      return creditedSeconds + Math.round((endedAt - joinedAt) / 1000);
    }
  }

  return creditedSeconds;
}

function evaluateParticipant(input: {
  participant: ChannelLiveSessionParticipantRow;
  expectedProfileIds: Set<string>;
  session: ChannelLiveSessionRow;
}): EvaluatedParticipant {
  const policy = getLiveSessionAttendancePolicy(input.session.attendance_policy);
  const requiredSeconds = calculateRequiredSeconds(input.session);
  const creditedSeconds = calculateCreditedSeconds(input.participant, input.session);
  const attended = Boolean(input.participant.first_joined_at);
  const expectedToAttend =
    input.participant.expected_to_attend === true ||
    input.expectedProfileIds.has(input.participant.profile_id);

  const attendanceRatio =
    requiredSeconds && requiredSeconds > 0
      ? Math.min(creditedSeconds / requiredSeconds, 1)
      : null;
  const qualifiedFullAttendance =
    attended &&
    requiredSeconds !== null &&
    creditedSeconds >=
      Math.ceil(requiredSeconds * (policy.fullAttendanceThresholdPercent / 100));

  let attendanceStatus: AttendanceStatus = expectedToAttend ? 'expected' : 'attended';
  let evaluationReason: string | null = null;

  if (input.session.ended_at) {
    if (expectedToAttend && !attended) {
      attendanceStatus = 'no_show';
      evaluationReason = 'Expected participant did not join before the session ended.';
    } else if (attended && qualifiedFullAttendance) {
      attendanceStatus = 'full';
      evaluationReason = null;
    } else if (attended) {
      attendanceStatus = 'partial';
      evaluationReason =
        requiredSeconds === null
          ? 'Session duration was unavailable at evaluation time.'
          : 'Participant attended below the full-attendance threshold.';
    } else {
      attendanceStatus = 'expected';
    }
  }

  return {
    participantId: input.participant.id,
    creditedSeconds,
    requiredSeconds,
    attendanceRatio,
    attended,
    expectedToAttend,
    qualifiedFullAttendance,
    attendanceStatus,
    evaluationReason,
  };
}

export async function evaluateLiveSessionAttendance(input: {
  supabase: SupabaseServiceClient;
  sessionId: string;
  orgId?: string | null;
}) {
  const sessionResponse = await input.supabase
    .from('channel_live_sessions')
    .select('*')
    .eq('id', input.sessionId)
    .is('deleted_at', null)
    .maybeSingle<ChannelLiveSessionRow>();

  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message);
  }

  const session = sessionResponse.data;
  if (!session) {
    throw new Error('Live session not found');
  }

  if (input.orgId && session.org_id !== input.orgId) {
    throw new Error('Unauthorized');
  }

  const [expectedResponse, participantsResponse] = await Promise.all([
    input.supabase
      .from('channel_live_session_expected_participants')
      .select('*')
      .eq('org_id', session.org_id)
      .eq('live_session_id', session.id)
      .is('deleted_at', null)
      .returns<ChannelLiveSessionExpectedParticipantRow[]>(),
    input.supabase
      .from('channel_live_session_participants')
      .select('*')
      .eq('org_id', session.org_id)
      .eq('live_session_id', session.id)
      .is('deleted_at', null)
      .returns<ChannelLiveSessionParticipantRow[]>(),
  ]);

  if (expectedResponse.error) {
    throw new Error(expectedResponse.error.message);
  }
  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }

  const expectedRows = expectedResponse.data ?? [];
  const participantRows = participantsResponse.data ?? [];
  const expectedProfileIds = new Set(expectedRows.map((row) => row.profile_id));
  const requiredSeconds = calculateRequiredSeconds(session);
  const sessionDurationSeconds = calculateSessionDurationSeconds(session);
  const now = new Date().toISOString();

  const participantRowsByProfileId = new Map(
    participantRows.map((row) => [row.profile_id, row]),
  );

  const missingExpectedProfileIds = Array.from(expectedProfileIds).filter(
    (profileId) => !participantRowsByProfileId.has(profileId),
  );

  if (missingExpectedProfileIds.length) {
    const upsertResponse = await input.supabase
      .from('channel_live_session_participants')
      .upsert(
        missingExpectedProfileIds.map((profileId) => ({
          org_id: session.org_id,
          live_session_id: session.id,
          channel_id: session.channel_id,
          profile_id: profileId,
          expected_to_attend: true,
          attendance_status: 'expected',
          qualified_full_attendance: false,
          updated_at: now,
        })),
        { onConflict: 'org_id,live_session_id,profile_id' },
      );

    if (upsertResponse.error) {
      throw new Error(upsertResponse.error.message);
    }

    missingExpectedProfileIds.forEach((profileId) => {
      participantRows.push({
        id: `expected:${profileId}`,
        org_id: session.org_id,
        live_session_id: session.id,
        channel_id: session.channel_id,
        profile_id: profileId,
        expected_to_attend: true,
        join_count: 0,
        qualified_full_attendance: false,
        created_at: now,
        updated_at: now,
      });
    });
  }

  const evaluated = participantRows.map((participant) =>
    evaluateParticipant({
      participant,
      expectedProfileIds,
      session,
    }),
  );

  for (const entry of evaluated) {
    const updateResponse = await input.supabase
      .from('channel_live_session_participants')
      .update({
        expected_to_attend: entry.expectedToAttend,
        attendance_status: entry.attendanceStatus,
        attendance_ratio: entry.attendanceRatio,
        qualified_full_attendance: entry.qualifiedFullAttendance,
        required_seconds: entry.requiredSeconds,
        credited_seconds: entry.creditedSeconds,
        evaluation_reason: entry.evaluationReason,
        evaluated_at: now,
        evaluation_version: ATTENDANCE_EVALUATION_VERSION,
        updated_at: now,
      })
      .eq('org_id', session.org_id)
      .eq('live_session_id', session.id)
      .eq('profile_id', participantRows.find((row) => row.id === entry.participantId)?.profile_id ?? '');

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message);
    }
  }

  const attendeeCount = evaluated.filter((entry) => entry.attended).length;
  const expectedParticipantCount = expectedProfileIds.size;
  const fullAttendanceCount = evaluated.filter((entry) => entry.attendanceStatus === 'full').length;
  const partialAttendanceCount = evaluated.filter((entry) => entry.attendanceStatus === 'partial').length;
  const noShowCount = evaluated.filter((entry) => entry.attendanceStatus === 'no_show').length;

  const sessionUpdateResponse = await input.supabase
    .from('channel_live_sessions')
    .update({
      expected_participant_count: expectedParticipantCount,
      attendee_count: attendeeCount,
      full_attendance_count: fullAttendanceCount,
      partial_attendance_count: partialAttendanceCount,
      no_show_count: noShowCount,
      session_duration_seconds: sessionDurationSeconds,
      report_generated_at: session.ended_at ? now : null,
      attendance_policy: getLiveSessionAttendancePolicy(session.attendance_policy),
      report_status: session.ended_at ? 'generated' : 'pending',
      updated_at: now,
    })
    .eq('id', session.id)
    .eq('org_id', session.org_id);

  if (sessionUpdateResponse.error) {
    throw new Error(sessionUpdateResponse.error.message);
  }

  return {
    expectedParticipantCount,
    attendeeCount,
    fullAttendanceCount,
    partialAttendanceCount,
    noShowCount,
    requiredSeconds,
    sessionDurationSeconds,
  };
}

export async function regenerateLiveSessionAttendanceReport(input: {
  supabase: SupabaseServiceClient;
  sessionId: string;
  orgId?: string | null;
}) {
  return evaluateLiveSessionAttendance(input);
}

export const __test__ = {
  ATTENDANCE_EVALUATION_VERSION,
  calculateSessionDurationSeconds,
  calculateScheduledDurationSeconds,
  calculateRequiredSeconds,
  calculateCreditedSeconds,
  evaluateParticipant,
  defaultAttendancePolicy: expectedParticipantsTest.DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY,
};
