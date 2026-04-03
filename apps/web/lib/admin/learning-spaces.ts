import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type {
  ChannelRow,
  ClassScheduleRow,
  ClassScheduleRecurrenceRow,
  LearningSpaceChannelRow,
  LearningSpaceParticipantRow,
  LearningSpaceRow,
  ProfileRow,
  ThemeKey,
} from '@iconicedu/shared-types';
import { resolveThemeKey } from '@iconicedu/web/lib/profile/derive';
import { getLearningSpacesByOrg } from '@iconicedu/web/lib/spaces/queries/learning-spaces.query';
import {
  getLearningSpaceChannelsByLearningSpaceIds,
  getLearningSpaceParticipantsByLearningSpaceIds,
} from '@iconicedu/web/lib/spaces/queries/learning-space-relations.query';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

export type AdminLearningSpaceRow = LearningSpaceRow & {
  themeKey?: ThemeKey | null;
  participantNames: string[];
  participantDetails: {
    id: string;
    displayName: string;
    kind: string;
    avatarUrl?: string | null;
    themeKey?: ThemeKey | null;
  }[];
  primaryChannelId?: string | null;
  scheduleSummary?: string | null;
  scheduleItems?: AdminLearningSpaceScheduleItem[] | null;
  updatedByDisplayName?: string | null;
};

export type AdminLearningSpaceScheduleItem = {
  kind: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  summary: string;
};

function getProfileDisplayName(profile: ProfileRow) {
  const display = profile.display_name?.trim() ?? '';
  if (display) return display;
  const first = profile.first_name?.trim() ?? '';
  const last = profile.last_name?.trim() ?? '';
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) {
    return first;
  }
  return 'Unknown';
}

export async function getAdminLearningSpaceRows(
  orgId: string,
): Promise<AdminLearningSpaceRow[]> {
  if (!orgId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await getLearningSpacesByOrg(supabase, orgId);

  if (!data?.length) {
    return [];
  }

  const learningSpaceIds = data.map((row) => row.id);
  const [participantsResponse, channelsResponse, schedulesResponse] = await Promise.all([
    getLearningSpaceParticipantsByLearningSpaceIds(supabase, orgId, learningSpaceIds),
    getLearningSpaceChannelsByLearningSpaceIds(supabase, orgId, learningSpaceIds),
    supabase
      .from('class_schedules')
      .select('id, source_learning_space_id, start_at, end_at, timezone')
      .eq('org_id', orgId)
      .in('source_learning_space_id', learningSpaceIds)
      .is('deleted_at', null)
      .returns<ClassScheduleRow[]>(),
  ]);
  const participants = participantsResponse.data ?? [];
  const channels = channelsResponse.data ?? [];
  const schedules = schedulesResponse.data ?? [];
  const channelIds = Array.from(
    new Set(channels.map((row) => row.channel_id).filter(Boolean)),
  );
  const { data: channelRows } = channelIds.length
    ? await supabase
        .from('channels')
        .select('id, ui_theme_key')
        .eq('org_id', orgId)
        .in('id', channelIds)
        .is('deleted_at', null)
        .returns<Pick<ChannelRow, 'id' | 'ui_theme_key'>[]>()
    : { data: [] as Pick<ChannelRow, 'id' | 'ui_theme_key'>[] };

  const scheduleIds = schedules.map((row) => row.id).filter(Boolean);
  const { data: recurrences, error: recurrenceError } = scheduleIds.length
    ? await supabase
        .from('class_schedule_recurrence')
        .select(
          'schedule_id, frequency, interval, count, until, timezone, raw_rrule, bysecond, byminute, byhour, byday, bymonthday, byyearday, byweekno, bymonth, bysetpos, wkst',
        )
        .eq('org_id', orgId)
        .in('schedule_id', scheduleIds)
        .is('deleted_at', null)
        .returns<ClassScheduleRecurrenceRow[]>()
    : { data: [] as ClassScheduleRecurrenceRow[], error: null };

  const recurrenceByScheduleId = new Map(
    (recurrenceError ? [] : (recurrences ?? [])).map((row) => [row.schedule_id, row]),
  );

  const participantsBySpace = new Map<string, LearningSpaceParticipantRow[]>();
  participants.forEach((row) => {
    const bucket = participantsBySpace.get(row.learning_space_id) ?? [];
    bucket.push(row);
    participantsBySpace.set(row.learning_space_id, bucket);
  });

  const channelsBySpace = new Map<string, LearningSpaceChannelRow[]>();
  channels.forEach((row) => {
    const bucket = channelsBySpace.get(row.learning_space_id) ?? [];
    bucket.push(row);
    channelsBySpace.set(row.learning_space_id, bucket);
  });
  const channelThemeById = new Map(
    (channelRows ?? []).map((row) => [row.id, resolveThemeKey(row.ui_theme_key ?? null)]),
  );

  const schedulesBySpace = new Map<string, ClassScheduleRow[]>();
  schedules.forEach((row) => {
    if (!row.source_learning_space_id) return;
    const bucket = schedulesBySpace.get(row.source_learning_space_id) ?? [];
    bucket.push(row);
    schedulesBySpace.set(row.source_learning_space_id, bucket);
  });

  const profileIds = Array.from(
    new Set([
      ...participants.map((row) => row.profile_id),
      ...data
        .map((row) => row.updated_by)
        .filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
    ]),
  );
  const { data: profiles } = await getProfilesByIds(supabase, orgId, profileIds);
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return data.map((row) => {
    const updatedByProfile = row.updated_by ? profilesById.get(row.updated_by) : null;
    return {
      ...row,
      themeKey: (() => {
        const primaryChannelId =
          (channelsBySpace.get(row.id) ?? []).find((item) => item.is_primary)
            ?.channel_id ?? null;
        return primaryChannelId ? (channelThemeById.get(primaryChannelId) ?? null) : null;
      })(),
      participantNames: (participantsBySpace.get(row.id) ?? [])
        .map((participant) => profilesById.get(participant.profile_id))
        .filter((profile): profile is ProfileRow => Boolean(profile))
        .map(getProfileDisplayName),
      participantDetails: (participantsBySpace.get(row.id) ?? [])
        .map((participant) => profilesById.get(participant.profile_id))
        .filter((profile): profile is ProfileRow => Boolean(profile))
        .map((profile) => ({
          id: profile.id,
          displayName: getProfileDisplayName(profile),
          kind: profile.kind,
          avatarUrl: profile.avatar_url ?? null,
          themeKey: resolveThemeKey(profile.ui_theme_key ?? null),
        })),
      primaryChannelId:
        (channelsBySpace.get(row.id) ?? []).find((item) => item.is_primary)?.channel_id ??
        null,
      scheduleSummary: (() => {
        const schedulesForSpace = schedulesBySpace.get(row.id) ?? [];
        if (!schedulesForSpace.length) return null;
        const selected = pickPrimarySchedule(schedulesForSpace);
        const recurrence = selected?.id
          ? recurrenceByScheduleId.get(selected.id)
          : undefined;
        return selected ? formatScheduleHeadline(recurrence) : null;
      })(),
      scheduleItems: (() => {
        const schedulesForSpace = schedulesBySpace.get(row.id) ?? [];
        if (!schedulesForSpace.length) return null;
        return [...schedulesForSpace]
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
          .map((schedule) =>
            formatScheduleItem(
              schedule,
              schedule.id ? recurrenceByScheduleId.get(schedule.id) : undefined,
            ),
          );
      })(),
      updatedByDisplayName: updatedByProfile
        ? getProfileDisplayName(updatedByProfile)
        : null,
    };
  });
}

function pickPrimarySchedule(schedules: ClassScheduleRow[]) {
  return [...schedules].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )[0];
}

function formatScheduleHeadline(
  recurrence?: Pick<ClassScheduleRecurrenceRow, 'frequency'> | null,
) {
  if (!recurrence?.frequency) return 'One-time';
  return `${recurrence.frequency.charAt(0).toUpperCase()}${recurrence.frequency.slice(1)}`;
}

function formatScheduleItem(
  schedule: Pick<ClassScheduleRow, 'start_at' | 'end_at' | 'timezone'>,
  recurrence?: Pick<
    ClassScheduleRecurrenceRow,
    'frequency' | 'byday' | 'timezone'
  > | null,
): AdminLearningSpaceScheduleItem {
  const timezone = recurrence?.timezone ?? schedule.timezone ?? undefined;
  const startAt = new Date(schedule.start_at);
  const endAt = new Date(schedule.end_at);
  return buildAdminScheduleSummary(
    {
      startAt,
      endAt,
    },
    {
      frequency: recurrence?.frequency,
      byday: recurrence?.byday ?? null,
      timezone,
    },
  );
}

function formatTimeShort(date: Date, timezone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone ?? undefined,
  }).format(date);
}

const WEEKDAY_FULL_LABELS: Record<string, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

function formatWeeklySummary(byday?: string[] | null) {
  const labels = (byday ?? [])
    .map((day) => WEEKDAY_FULL_LABELS[day] ?? day)
    .filter(Boolean);
  if (!labels.length) return 'Weekly';
  return `Weekly · Every ${labels.join(', ')}`;
}

export function buildAdminScheduleSummary(
  schedule: {
    startAt: Date;
    endAt: Date;
  },
  recurrence?: {
    frequency?: string | null;
    byday?: string[] | null;
    timezone?: string | null;
  } | null,
): AdminLearningSpaceScheduleItem {
  const timezone = recurrence?.timezone ?? undefined;
  const timeRange = `${formatTimeShort(schedule.startAt, timezone)} - ${formatTimeShort(schedule.endAt, timezone)}`;
  const frequency = recurrence?.frequency?.toLowerCase();

  if (frequency === 'weekly') {
    return {
      kind: 'weekly',
      summary: `${formatWeeklySummary(recurrence?.byday)} · ${timeRange}`,
    };
  }

  if (frequency === 'daily') {
    return {
      kind: 'daily',
      summary: `Daily · Every day · ${timeRange}`,
    };
  }

  if (frequency === 'monthly') {
    return {
      kind: 'monthly',
      summary: `Monthly · Every month · ${timeRange}`,
    };
  }

  if (frequency === 'yearly') {
    return {
      kind: 'yearly',
      summary: `Yearly · Every year · ${timeRange}`,
    };
  }

  return {
    kind: 'none',
    summary: `No repeat · ${timeRange}`,
  };
}
