import type {
  ChannelLiveSessionParticipantEventRow,
  ChannelLiveSessionParticipantRow,
  ChannelLiveSessionRow,
  ChannelRow,
  LearningSpaceChannelRow,
  LearningSpaceRow,
  LiveSessionAttendanceDetailVM,
  LiveSessionAttendanceListItemVM,
  LiveSessionAttendanceParticipantVM,
  LiveSessionAttendancePolicyVM,
  LiveSessionParticipantTimelineVM,
  ProfileRow,
} from '@iconicedu/shared-types';

function toDisplayName(
  profile: Pick<ProfileRow, 'display_name' | 'first_name' | 'last_name'>,
) {
  const display = profile.display_name?.trim() ?? '';
  if (display) {
    return display;
  }

  const first = profile.first_name?.trim() ?? '';
  const last = profile.last_name?.trim() ?? '';
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) {
    return first;
  }
  return 'User';
}

function toProfileSummary(profile: ProfileRow | null) {
  if (!profile) {
    return null;
  }

  return {
    ids: {
      id: profile.id,
      orgId: profile.org_id,
      accountId: profile.account_id,
    },
    kind: profile.kind as 'educator' | 'guardian' | 'child' | 'staff' | 'system',
    profile: {
      displayName: toDisplayName(profile),
      firstName: profile.first_name ?? null,
      lastName: profile.last_name ?? null,
      email: null,
      phoneE164: null,
      bio: profile.bio ?? null,
      avatar: {
        source: profile.avatar_source as 'uploaded' | 'generated' | 'external',
        url: profile.avatar_url ?? null,
        seed: profile.avatar_seed ?? null,
      },
    },
  };
}

function resolveScope(session: ChannelLiveSessionRow) {
  return session.occurrence_key ? 'scheduled' : 'ad-hoc';
}

function resolveDurationSeconds(session: ChannelLiveSessionRow) {
  if (!session.ended_at) {
    return null;
  }

  const startedAt = new Date(session.started_at).getTime();
  const endedAt = new Date(session.ended_at).getTime();
  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
    return null;
  }

  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

function buildMetrics(
  session: ChannelLiveSessionRow,
  participants: ChannelLiveSessionParticipantRow[],
) {
  const participantCount = participants.length;
  const expectedParticipantCount =
    session.expected_participant_count ??
    participants.filter((row) => row.expected_to_attend === true).length;
  const attendeeRows = participants.filter((row) => Boolean(row.first_joined_at));
  const attendeeCount = session.attendee_count ?? attendeeRows.length;
  const fullAttendanceCount =
    session.full_attendance_count ??
    participants.filter((row) => row.attendance_status === 'full').length;
  const partialAttendanceCount =
    session.partial_attendance_count ??
    participants.filter((row) => row.attendance_status === 'partial').length;
  const noShowCount =
    session.no_show_count ??
    participants.filter((row) => row.attendance_status === 'no_show').length;
  const durations = attendeeRows
    .map((row) => row.credited_seconds ?? row.total_seconds ?? null)
    .filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value),
    );
  const denominator = expectedParticipantCount || participantCount || 0;

  return {
    participantCount,
    expectedParticipantCount,
    attendeeCount,
    fullAttendanceCount,
    partialAttendanceCount,
    noShowCount,
    attendanceRate: denominator ? attendeeCount / denominator : null,
    fullAttendanceRate: denominator ? fullAttendanceCount / denominator : null,
    averageAttendanceSeconds: durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null,
    durationSeconds: session.session_duration_seconds ?? resolveDurationSeconds(session),
  };
}

function resolveAttendancePolicy(
  session: ChannelLiveSessionRow,
): LiveSessionAttendancePolicyVM {
  const value = session.attendance_policy;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      fullAttendanceThresholdPercent: 90,
      graceSeconds: 0,
      countLateJoinAsAttended: true,
      countRejoins: true,
      source: 'hybrid',
    };
  }

  return {
    fullAttendanceThresholdPercent:
      typeof value.fullAttendanceThresholdPercent === 'number'
        ? value.fullAttendanceThresholdPercent
        : 90,
    graceSeconds: typeof value.graceSeconds === 'number' ? value.graceSeconds : 0,
    countLateJoinAsAttended:
      typeof value.countLateJoinAsAttended === 'boolean'
        ? value.countLateJoinAsAttended
        : true,
    countRejoins: typeof value.countRejoins === 'boolean' ? value.countRejoins : true,
    source: 'hybrid',
  };
}

function buildTimeline(
  events: ChannelLiveSessionParticipantEventRow[],
  profiles: ProfileRow[],
): LiveSessionParticipantTimelineVM[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return events.map((event) => ({
    id: event.id,
    liveSessionId: event.live_session_id,
    profileId: event.profile_id ?? null,
    participantDisplayName: event.profile_id
      ? (profileById.get(event.profile_id)?.display_name ?? null)
      : null,
    providerParticipantId: event.provider_participant_id ?? null,
    provider: event.provider as LiveSessionParticipantTimelineVM['provider'],
    eventType: event.event_type as LiveSessionParticipantTimelineVM['eventType'],
    occurredAt: event.occurred_at,
    source: event.source as LiveSessionParticipantTimelineVM['source'],
    correlationKey: event.correlation_key ?? null,
    payload: event.payload ?? null,
  }));
}

export function buildLiveSessionAttendanceListItemVM(input: {
  session: ChannelLiveSessionRow;
  channel: ChannelRow | null;
  learningSpaceLink: LearningSpaceChannelRow | null;
  learningSpace: LearningSpaceRow | null;
  participants: ChannelLiveSessionParticipantRow[];
  starterProfile: ProfileRow | null;
}): LiveSessionAttendanceListItemVM {
  return {
    ids: {
      id: input.session.id,
      orgId: input.session.org_id,
      channelId: input.session.channel_id,
    },
    provider: input.session.provider as LiveSessionAttendanceListItemVM['provider'],
    status: input.session.status as LiveSessionAttendanceListItemVM['status'],
    scope: resolveScope(input.session),
    occurrenceKey: input.session.occurrence_key ?? null,
    channelTopic: input.channel?.topic ?? 'Untitled channel',
    channelPurpose: input.channel?.purpose ?? 'general',
    learningSpaceId: input.learningSpaceLink?.learning_space_id ?? null,
    learningSpaceTitle: input.learningSpace?.title ?? null,
    startedAt: input.session.started_at,
    endedAt: input.session.ended_at ?? null,
    failedAt: input.session.failed_at ?? null,
    failureReason: input.session.failure_reason ?? null,
    joinPath: input.session.join_path,
    reportGeneratedAt: input.session.report_generated_at ?? null,
    startedBy: toProfileSummary(input.starterProfile),
    metrics: buildMetrics(input.session, input.participants),
  };
}

export function buildLiveSessionAttendanceParticipantVM(input: {
  participantRow: ChannelLiveSessionParticipantRow;
  profile: ProfileRow | null;
}): LiveSessionAttendanceParticipantVM {
  return {
    ids: {
      id: input.participantRow.id,
      orgId: input.participantRow.org_id,
      liveSessionId: input.participantRow.live_session_id,
      channelId: input.participantRow.channel_id,
      profileId: input.participantRow.profile_id,
    },
    participant: toProfileSummary(input.profile),
    joinRequestedAt: input.participantRow.join_requested_at ?? null,
    firstJoinedAt: input.participantRow.first_joined_at ?? null,
    lastJoinedAt: input.participantRow.last_joined_at ?? null,
    lastLeftAt: input.participantRow.last_left_at ?? null,
    joinCount: input.participantRow.join_count ?? 0,
    totalSeconds: input.participantRow.total_seconds ?? null,
    lastKnownStatus: (input.participantRow.last_known_status ??
      'requested') as LiveSessionAttendanceParticipantVM['lastKnownStatus'],
    attended: Boolean(input.participantRow.first_joined_at),
    noShow: input.participantRow.attendance_status === 'no_show',
    expectedToAttend: input.participantRow.expected_to_attend === true,
    attendanceStatus:
      (input.participantRow
        .attendance_status as LiveSessionAttendanceParticipantVM['attendanceStatus']) ??
      (input.participantRow.first_joined_at ? 'partial' : 'expected'),
    attendanceRatio: input.participantRow.attendance_ratio ?? null,
    qualifiedFullAttendance: input.participantRow.qualified_full_attendance === true,
    requiredSeconds: input.participantRow.required_seconds ?? null,
    creditedSeconds:
      input.participantRow.credited_seconds ?? input.participantRow.total_seconds ?? null,
    evaluationReason: input.participantRow.evaluation_reason ?? null,
  };
}

export function buildLiveSessionAttendanceDetailVM(input: {
  session: ChannelLiveSessionRow;
  channel: ChannelRow | null;
  learningSpaceLink: LearningSpaceChannelRow | null;
  learningSpace: LearningSpaceRow | null;
  participants: ChannelLiveSessionParticipantRow[];
  events: ChannelLiveSessionParticipantEventRow[];
  profiles: ProfileRow[];
  starterProfile: ProfileRow | null;
}): LiveSessionAttendanceDetailVM {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));

  return {
    session: buildLiveSessionAttendanceListItemVM({
      session: input.session,
      channel: input.channel,
      learningSpaceLink: input.learningSpaceLink,
      learningSpace: input.learningSpace,
      participants: input.participants,
      starterProfile: input.starterProfile,
    }),
    policy: resolveAttendancePolicy(input.session),
    reportGeneratedAt: input.session.report_generated_at ?? null,
    participants: input.participants.map((participantRow) =>
      buildLiveSessionAttendanceParticipantVM({
        participantRow,
        profile: profileById.get(participantRow.profile_id) ?? null,
      }),
    ),
    timeline: buildTimeline(input.events, input.profiles),
  };
}
