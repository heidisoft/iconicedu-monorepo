import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type {
  ClassScheduleRow,
  ClassScheduleRecurrenceRow,
  LearningSpaceChannelRow,
  LearningSpaceParticipantRow,
  LearningSpaceRow,
  ProfileRow,
} from '@iconicedu/shared-types';
import { getLearningSpacesByOrg } from '@iconicedu/web/lib/spaces/queries/learning-spaces.query';
import {
  getLearningSpaceChannelsByLearningSpaceIds,
  getLearningSpaceParticipantsByLearningSpaceIds,
} from '@iconicedu/web/lib/spaces/queries/learning-space-relations.query';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

export type AdminLearningSpaceRow = LearningSpaceRow & {
  participantNames: string[];
  participantDetails: {
    id: string;
    displayName: string;
    kind: string;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }[];
  primaryChannelId?: string | null;
  scheduleSummary?: string | null;
  scheduleItems?: string[] | null;
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

export async function getAdminLearningSpaceRows(orgId: string): Promise<AdminLearningSpaceRow[]> {
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
      .select('id, source_learning_space_id, start_at, timezone')
      .eq('org_id', orgId)
      .in('source_learning_space_id', learningSpaceIds)
      .is('deleted_at', null)
      .returns<ClassScheduleRow[]>(),
  ]);
  const participants = participantsResponse.data ?? [];
  const channels = channelsResponse.data ?? [];
  const schedules = schedulesResponse.data ?? [];

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
    (recurrenceError ? [] : recurrences ?? []).map((row) => [row.schedule_id, row]),
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

  const schedulesBySpace = new Map<string, ClassScheduleRow[]>();
  schedules.forEach((row) => {
    if (!row.source_learning_space_id) return;
    const bucket = schedulesBySpace.get(row.source_learning_space_id) ?? [];
    bucket.push(row);
    schedulesBySpace.set(row.source_learning_space_id, bucket);
  });

  const profileIds = Array.from(new Set(participants.map((row) => row.profile_id)));
  const { data: profiles } = await getProfilesByIds(supabase, orgId, profileIds);
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return data.map((row) => ({
    ...row,
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
        themeKey: profile.ui_theme_key ?? null,
      })),
    primaryChannelId: (channelsBySpace.get(row.id) ?? []).find((item) => item.is_primary)
      ?.channel_id ?? null,
    scheduleSummary: (() => {
      const schedulesForSpace = schedulesBySpace.get(row.id) ?? [];
      if (!schedulesForSpace.length) return null;
      const selected = pickPrimarySchedule(schedulesForSpace);
      const recurrence = selected?.id ? recurrenceByScheduleId.get(selected.id) : undefined;
      return selected ? formatScheduleHeadline(recurrence) : null;
    })(),
    scheduleItems: (() => {
      const schedulesForSpace = schedulesBySpace.get(row.id) ?? [];
      if (!schedulesForSpace.length) return null;
      const selected = pickPrimarySchedule(schedulesForSpace);
      const recurrence = selected?.id ? recurrenceByScheduleId.get(selected.id) : undefined;
      return selected ? formatScheduleItems(selected, recurrence) : null;
    })(),
  }));
}

const WEEKDAY_LABELS: Record<string, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

function formatScheduleSummary(
  schedule: Pick<ClassScheduleRow, 'start_at'>,
  recurrence?: Pick<ClassScheduleRecurrenceRow, 'frequency' | 'byday' | 'timezone'> | null,
) {
  const start = new Date(schedule.start_at);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: recurrence?.timezone ?? undefined,
    timeZoneName: 'short',
  }).format(start);

  const frequency = recurrence?.frequency
    ? `${recurrence.frequency.charAt(0).toUpperCase()}${recurrence.frequency.slice(1)}`
    : 'One-time';

  const weekdayFromDate = (() => {
    const order = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
    const key = order[start.getDay()];
    return key ? WEEKDAY_LABELS[key] : '';
  })();

  const weekdays = recurrence?.byday?.length
    ? recurrence.byday.map((day) => WEEKDAY_LABELS[day] ?? day).join(', ')
    : weekdayFromDate;

  return weekdays ? `${frequency} ${weekdays} ${time}` : `${frequency} ${time}`;
}

function pickPrimarySchedule(schedules: ClassScheduleRow[]) {
  return [...schedules].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )[0];
}

function formatRfc5545Schedule(
  schedule: Pick<ClassScheduleRow, 'start_at' | 'timezone'>,
  recurrence?: Pick<
    ClassScheduleRecurrenceRow,
    | 'frequency'
    | 'interval'
    | 'count'
    | 'until'
    | 'timezone'
    | 'raw_rrule'
    | 'bysecond'
    | 'byminute'
    | 'byhour'
    | 'byday'
    | 'bymonthday'
    | 'byyearday'
    | 'byweekno'
    | 'bymonth'
    | 'bysetpos'
    | 'wkst'
  > | null,
) {
  const timezone = recurrence?.timezone ?? schedule.timezone ?? undefined;
  const startDate = new Date(schedule.start_at);
  const dtStart = buildRfcDateTime(startDate, timezone);
  const lines = [dtStart];

  if (recurrence?.raw_rrule) {
    lines.push(`RRULE:${recurrence.raw_rrule}`);
  } else if (recurrence?.frequency) {
    const parts: string[] = [`FREQ=${recurrence.frequency.toUpperCase()}`];
    if (recurrence.interval && recurrence.interval > 1) {
      parts.push(`INTERVAL=${recurrence.interval}`);
    }
    if (recurrence.bysecond?.length) {
      parts.push(`BYSECOND=${recurrence.bysecond.join(',')}`);
    }
    if (recurrence.byminute?.length) {
      parts.push(`BYMINUTE=${recurrence.byminute.join(',')}`);
    }
    if (recurrence.byhour?.length) {
      parts.push(`BYHOUR=${recurrence.byhour.join(',')}`);
    }
    if (recurrence.byday?.length) {
      parts.push(`BYDAY=${recurrence.byday.join(',')}`);
    }
    if (recurrence.bymonthday?.length) {
      parts.push(`BYMONTHDAY=${recurrence.bymonthday.join(',')}`);
    }
    if (recurrence.byyearday?.length) {
      parts.push(`BYYEARDAY=${recurrence.byyearday.join(',')}`);
    }
    if (recurrence.byweekno?.length) {
      parts.push(`BYWEEKNO=${recurrence.byweekno.join(',')}`);
    }
    if (recurrence.bymonth?.length) {
      parts.push(`BYMONTH=${recurrence.bymonth.join(',')}`);
    }
    if (recurrence.bysetpos?.length) {
      parts.push(`BYSETPOS=${recurrence.bysetpos.join(',')}`);
    }
    if (recurrence.wkst) {
      parts.push(`WKST=${recurrence.wkst}`);
    }
    if (recurrence.count) {
      parts.push(`COUNT=${recurrence.count}`);
    }
    if (recurrence.until) {
      parts.push(`UNTIL=${buildUtcDateTime(new Date(recurrence.until))}`);
    }
    lines.push(`RRULE:${parts.join(';')}`);
  }

  return lines.join('\n');
}

function formatScheduleHeadline(
  recurrence?: Pick<ClassScheduleRecurrenceRow, 'frequency'> | null,
) {
  if (!recurrence?.frequency) return 'One-time';
  return `${recurrence.frequency.charAt(0).toUpperCase()}${recurrence.frequency.slice(1)}`;
}

function formatScheduleItems(
  schedule: Pick<ClassScheduleRow, 'start_at' | 'timezone'>,
  recurrence?: Pick<ClassScheduleRecurrenceRow, 'byday' | 'timezone'> | null,
) {
  const time = formatTimeShort(
    new Date(schedule.start_at),
    recurrence?.timezone ?? schedule.timezone ?? undefined,
  );
  const weekdays = recurrence?.byday?.length
    ? recurrence.byday.map((day) => WEEKDAY_LABELS[day] ?? day)
    : [
        (() => {
          const order = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
          const key = order[new Date(schedule.start_at).getDay()];
          return key ? WEEKDAY_LABELS[key] : '';
        })(),
      ];

  return weekdays.filter(Boolean).map((day) => `${day} ${time}`);
}

function formatTimeShort(date: Date, timezone?: string) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone ?? undefined,
  }).format(date);
  const cleaned = formatted.replace(':00', '').replace(' AM', ' am').replace(' PM', ' pm');
  return cleaned;
}

function buildRfcDateTime(date: Date, timezone?: string) {
  if (timezone) {
    return `DTSTART;TZID=${timezone}:${formatZonedDateTime(date, timezone)}`;
  }
  return `DTSTART:${buildUtcDateTime(date)}`;
}

function buildUtcDateTime(date: Date) {
  const utc = new Date(date);
  return `${utc.getUTCFullYear()}${pad2(utc.getUTCMonth() + 1)}${pad2(
    utc.getUTCDate(),
  )}T${pad2(utc.getUTCHours())}${pad2(utc.getUTCMinutes())}${pad2(
    utc.getUTCSeconds(),
  )}Z`;
}

function formatZonedDateTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get(
    'second',
  )}`;
}

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}
