import type {
  ChannelLiveSessionExpectedParticipantRow,
  ClassScheduleParticipantVM,
  LiveSessionAttendancePolicyVM,
} from '@iconicedu/shared-types';

import type { ResolvedLiveSessionScope } from '@iconicedu/web/lib/live-sessions/types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type ChannelLiveSessionRowRecord = {
  id: string;
  org_id: string;
  channel_id: string;
  occurrence_key?: string | null;
  attendance_policy?: Record<string, unknown> | null;
};

type ChannelMemberSummaryRow = {
  profile_id: string;
};

const DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY: LiveSessionAttendancePolicyVM = {
  fullAttendanceThresholdPercent: 90,
  graceSeconds: 0,
  countLateJoinAsAttended: true,
  countRejoins: true,
  source: 'hybrid',
};

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getLiveSessionAttendancePolicy(
  value: unknown,
): LiveSessionAttendancePolicyVM {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY;
  }

  const candidate = value as Record<string, unknown>;
  return {
    fullAttendanceThresholdPercent:
      toNumber(candidate.fullAttendanceThresholdPercent) ??
      DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY.fullAttendanceThresholdPercent,
    graceSeconds:
      toNumber(candidate.graceSeconds) ??
      DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY.graceSeconds,
    countLateJoinAsAttended:
      typeof candidate.countLateJoinAsAttended === 'boolean'
        ? candidate.countLateJoinAsAttended
        : DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY.countLateJoinAsAttended,
    countRejoins:
      typeof candidate.countRejoins === 'boolean'
        ? candidate.countRejoins
        : DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY.countRejoins,
    source: 'hybrid',
  };
}

async function listChannelMemberProfileIds(input: {
  supabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
}) {
  const response = await input.supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .is('deleted_at', null)
    .returns<ChannelMemberSummaryRow[]>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return (response.data ?? []).map((row) => row.profile_id);
}

function buildExpectedParticipantRows(input: {
  session: ChannelLiveSessionRowRecord;
  scope: ResolvedLiveSessionScope;
  profileIds: string[];
  createdBy?: string | null;
}): Array<Omit<ChannelLiveSessionExpectedParticipantRow, 'id'>> {
  const now = new Date().toISOString();
  const sourceKind = input.scope.schedule ? 'scheduled_roster' : 'channel_membership';
  const sourceRef = input.scope.schedule
    ? {
        occurrenceKey: input.scope.occurrenceKey ?? null,
        occurrenceEndAt: input.scope.occurrenceEndAt ?? null,
        scheduleId: input.scope.schedule.ids.id,
        scheduleTitle: input.scope.schedule.title,
        participantIds: input.scope.schedule.participants.map(
          (participant: ClassScheduleParticipantVM) => participant.ids.id,
        ),
      }
    : {
        occurrenceKey: input.scope.occurrenceKey ?? null,
        occurrenceEndAt: input.scope.occurrenceEndAt ?? null,
        channelId: input.session.channel_id,
      };

  return input.profileIds.map((profileId) => ({
    org_id: input.session.org_id,
    live_session_id: input.session.id,
    channel_id: input.session.channel_id,
    profile_id: profileId,
    source_kind: sourceKind,
    source_ref: sourceRef,
    created_at: now,
    created_by: input.createdBy ?? null,
    updated_at: now,
    updated_by: input.createdBy ?? null,
  }));
}

export async function snapshotExpectedParticipantsForLiveSession(input: {
  supabase: SupabaseServiceClient;
  session: ChannelLiveSessionRowRecord;
  scope: ResolvedLiveSessionScope;
  createdBy?: string | null;
}) {
  const existingResponse = await input.supabase
    .from('channel_live_session_expected_participants')
    .select('id')
    .eq('org_id', input.session.org_id)
    .eq('live_session_id', input.session.id)
    .is('deleted_at', null)
    .returns<Array<{ id: string }>>();

  if (existingResponse.error) {
    throw new Error(existingResponse.error.message);
  }

  if ((existingResponse.data ?? []).length > 0) {
    return existingResponse.data?.length ?? 0;
  }

  const profileIds = input.scope.schedule
    ? input.scope.schedule.participants.map((participant) => participant.ids.id)
    : await listChannelMemberProfileIds({
        supabase: input.supabase,
        orgId: input.session.org_id,
        channelId: input.session.channel_id,
      });

  if (!profileIds.length) {
    return 0;
  }

  const uniqueProfileIds = Array.from(new Set(profileIds));
  const rows = buildExpectedParticipantRows({
    session: input.session,
    scope: input.scope,
    profileIds: uniqueProfileIds,
    createdBy: input.createdBy ?? null,
  });

  const insertResponse = await input.supabase
    .from('channel_live_session_expected_participants')
    .insert(rows);

  if (insertResponse.error) {
    throw new Error(insertResponse.error.message);
  }

  const now = new Date().toISOString();
  const participantRows = uniqueProfileIds.map((profileId) => ({
    org_id: input.session.org_id,
    live_session_id: input.session.id,
    channel_id: input.session.channel_id,
    profile_id: profileId,
    expected_to_attend: true,
    attendance_status: 'expected',
    qualified_full_attendance: false,
    updated_at: now,
    updated_by: input.createdBy ?? null,
  }));

  const participantResponse = await input.supabase
    .from('channel_live_session_participants')
    .upsert(participantRows, { onConflict: 'org_id,live_session_id,profile_id' });

  if (participantResponse.error) {
    throw new Error(participantResponse.error.message);
  }

  const appMetadata = {
    ...(input.session.attendance_policy ? {} : {}),
    occurrenceEndAt: input.scope.occurrenceEndAt ?? null,
    occurrenceLabel: input.scope.occurrenceLabel ?? null,
    scheduleId: input.scope.schedule?.ids.id ?? null,
    scheduleTitle: input.scope.schedule?.title ?? null,
  };

  const updateResponse = await input.supabase
    .from('channel_live_sessions')
    .update({
      expected_participant_count: uniqueProfileIds.length,
      attendance_policy: getLiveSessionAttendancePolicy(input.session.attendance_policy),
      app_metadata: appMetadata,
      report_status: 'pending',
      updated_at: now,
      updated_by: input.createdBy ?? null,
    })
    .eq('id', input.session.id)
    .eq('org_id', input.session.org_id);

  if (updateResponse.error) {
    throw new Error(updateResponse.error.message);
  }

  return uniqueProfileIds.length;
}

export const __test__ = {
  DEFAULT_LIVE_SESSION_ATTENDANCE_POLICY,
  getLiveSessionAttendancePolicy,
};
