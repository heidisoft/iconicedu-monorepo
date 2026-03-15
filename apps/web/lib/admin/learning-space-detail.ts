import type {
  ChannelLiveSessionConfigVM,
  ChannelUiDefaultsVM,
  ClassScheduleRecurrenceExceptionRow,
  ClassScheduleRecurrenceOverrideRow,
  ClassScheduleRecurrenceRow,
  ClassScheduleRow,
  LearningSpaceLinkRow,
  LearningSpaceLinkVM,
  LearningSpaceParticipantRow,
  LearningSpaceRow,
  ThemeKey,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type {
  RecurrenceFormData,
  WeekdayVM,
} from '@iconicedu/ui-web/lib/recurrence-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  buildCanonicalLearningSpaceScheduleFromExisting,
  createFormDateFromIsoInTimezone,
  getDateFromISOInTimezone,
  getTimeFromISOInTimezone,
  normalizeScheduleFormDate,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapLearningSpaceLinkRow } from '@iconicedu/web/lib/spaces/mappers/learning-space.mapper';
import { getAdminLiveSessionConfig } from '@iconicedu/web/lib/admin/live-session-config';

export type LearningSpaceDetail = {
  ids: { id: string; orgId: string };
  basics: {
    kind: string;
    title: string;
    iconKey: string | null;
    subject: string | null;
    description: string | null;
  };
  settings: {
    themeKey: ThemeKey | null;
    uiDefaults?: ChannelUiDefaultsVM | null;
  };
  liveSession: ChannelLiveSessionConfigVM;
  participants: UserProfileVM[];
  resources: LearningSpaceLinkVM[];
  schedules: RecurrenceFormData[];
};

export {
  createFormDateFromIsoInTimezone,
  getDateFromISOInTimezone,
  getTimeFromISOInTimezone,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';

function getUtcDateFromISO(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function getUtcTimeFromISO(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isUtcNaiveStoredTimestamp(
  value: string,
  timezone: string,
  expectedLocalTime: string,
) {
  const localTime = getTimeFromISOInTimezone(value, timezone);
  const utcTime = getUtcTimeFromISO(value);
  return localTime !== expectedLocalTime && utcTime === expectedLocalTime;
}

export function resolveStoredOccurrenceDateForForm(
  value: string,
  timezone: string,
  expectedLocalTime: string,
) {
  const localDate = getDateFromISOInTimezone(value, timezone);
  const utcDate = getUtcDateFromISO(value);
  return isUtcNaiveStoredTimestamp(value, timezone, expectedLocalTime)
    ? (utcDate ?? localDate)
    : (localDate ?? utcDate);
}

export function resolveStoredScheduleDateTimeForForm(
  value: string,
  timezone: string,
  expectedLocalTime?: string | null,
) {
  const normalizedExpectedLocalTime =
    typeof expectedLocalTime === 'string' && expectedLocalTime.trim().length > 0
      ? expectedLocalTime
      : null;
  const useUtcNaiveInterpretation = normalizedExpectedLocalTime
    ? isUtcNaiveStoredTimestamp(value, timezone, normalizedExpectedLocalTime)
    : false;

  return {
    date: useUtcNaiveInterpretation
      ? (getUtcDateFromISO(value) ?? getDateFromISOInTimezone(value, timezone))
      : (getDateFromISOInTimezone(value, timezone) ?? getUtcDateFromISO(value)),
    time: useUtcNaiveInterpretation
      ? (getUtcTimeFromISO(value) ?? getTimeFromISOInTimezone(value, timezone))
      : (getTimeFromISOInTimezone(value, timezone) ?? getUtcTimeFromISO(value)),
    useUtcNaiveInterpretation,
  };
}

function parseOverridePatchForDetail(patch: Record<string, unknown> | null | undefined) {
  const parseString = (value: unknown) => (typeof value === 'string' ? value : null);
  const normalizeReason = (value: unknown) => {
    const text = parseString(value);
    if (!text) return null;
    const trimmed = text.trim();
    return trimmed.length ? trimmed : null;
  };

  if (!patch) {
    return { startAt: null, endAt: null, reason: null };
  }

  return {
    startAt: parseString(patch.startAt) ?? parseString(patch.start_at),
    endAt: parseString(patch.endAt) ?? parseString(patch.end_at),
    reason: normalizeReason(patch.reason) ?? normalizeReason(patch.description),
  };
}

export async function getLearningSpaceDetail(learningSpaceId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const orgId = accountResponse.data.org_id;

  const { data: learningSpace, error: learningSpaceError } = await supabase
    .from('learning_spaces')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', learningSpaceId)
    .is('deleted_at', null)
    .maybeSingle<LearningSpaceRow>();

  if (learningSpaceError) {
    throw new Error(learningSpaceError.message);
  }

  if (!learningSpace) {
    throw new Error('Class not found');
  }

  const [participantsResponse, linksResponse, schedulesResponse, channelLinksResponse] =
    await Promise.all([
      supabase
        .from('learning_space_participants')
        .select('*')
        .eq('org_id', orgId)
        .eq('learning_space_id', learningSpaceId)
        .is('deleted_at', null)
        .returns<LearningSpaceParticipantRow[]>(),
      supabase
        .from('learning_space_links')
        .select('*')
        .eq('org_id', orgId)
        .eq('learning_space_id', learningSpaceId)
        .is('deleted_at', null)
        .returns<LearningSpaceLinkRow[]>(),
      supabase
        .from('class_schedules')
        .select('*')
        .eq('org_id', orgId)
        .eq('source_learning_space_id', learningSpaceId)
        .is('deleted_at', null)
        .returns<ClassScheduleRow[]>(),
      supabase
        .from('learning_space_channels')
        .select('channel_id')
        .eq('org_id', orgId)
        .eq('learning_space_id', learningSpaceId)
        .eq('is_primary', true)
        .is('deleted_at', null)
        .maybeSingle<{ channel_id: string }>(),
    ]);

  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }
  if (linksResponse.error) {
    throw new Error(linksResponse.error.message);
  }
  if (schedulesResponse.error) {
    throw new Error(schedulesResponse.error.message);
  }
  if (channelLinksResponse.error) {
    throw new Error(channelLinksResponse.error.message);
  }

  const primaryChannelId = channelLinksResponse.data?.channel_id ?? null;
  let channelThemeKey: ThemeKey | null = null;
  let channelUiDefaults: ChannelUiDefaultsVM | null = null;
  let channelLiveSessionConfig: unknown = null;
  if (primaryChannelId) {
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('ui_theme_key, ui_defaults, live_session_config')
      .eq('org_id', orgId)
      .eq('id', primaryChannelId)
      .is('deleted_at', null)
      .maybeSingle<{
        ui_theme_key?: string | null;
        ui_defaults?: unknown;
        live_session_config?: unknown;
      }>();

    if (channelError) {
      throw new Error(channelError.message);
    }
    channelThemeKey = (channel?.ui_theme_key ?? null) as ThemeKey | null;
    channelUiDefaults =
      channel?.ui_defaults && typeof channel.ui_defaults === 'object'
        ? (channel.ui_defaults as ChannelUiDefaultsVM)
        : null;
    channelLiveSessionConfig = channel?.live_session_config ?? null;
  }

  const participantProfiles = await Promise.all(
    (participantsResponse.data ?? []).map((row) =>
      buildUserProfileById(supabase, row.profile_id),
    ),
  );
  const participants = participantProfiles.filter((profile): profile is UserProfileVM =>
    Boolean(profile),
  );

  const schedules = await buildSchedulesForForm(
    supabase,
    orgId,
    schedulesResponse.data ?? [],
  );

  return {
    ids: { id: learningSpace.id, orgId },
    basics: {
      kind: learningSpace.kind,
      title: learningSpace.title,
      iconKey: learningSpace.icon_key ?? null,
      subject: learningSpace.subject ?? null,
      description: learningSpace.description ?? null,
    },
    settings: {
      themeKey: channelThemeKey,
      uiDefaults: channelUiDefaults,
    },
    liveSession: getAdminLiveSessionConfig(channelLiveSessionConfig),
    participants,
    resources: (linksResponse.data ?? []).map(mapLearningSpaceLinkRow),
    schedules,
  } satisfies LearningSpaceDetail;
}

const VALID_WEEKDAYS: Set<WeekdayVM> = new Set([
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
]);

function isWeekday(value: string): value is WeekdayVM {
  return VALID_WEEKDAYS.has(value as WeekdayVM);
}

async function buildSchedulesForForm(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  schedules: ClassScheduleRow[],
): Promise<RecurrenceFormData[]> {
  if (!schedules.length) {
    return [];
  }

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const { data: recurrences, error: recurrenceError } = await supabase
    .from('class_schedule_recurrence')
    .select('*')
    .eq('org_id', orgId)
    .in('schedule_id', scheduleIds)
    .is('deleted_at', null)
    .returns<ClassScheduleRecurrenceRow[]>();

  if (recurrenceError) {
    throw new Error(recurrenceError.message);
  }

  const recurrenceIds = (recurrences ?? []).map((row) => row.id);

  const [exceptionsResponse, overridesResponse] = await Promise.all([
    recurrenceIds.length
      ? supabase
          .from('class_schedule_recurrence_exceptions')
          .select('*')
          .eq('org_id', orgId)
          .in('recurrence_id', recurrenceIds)
          .returns<ClassScheduleRecurrenceExceptionRow[]>()
      : Promise.resolve({ data: [] as ClassScheduleRecurrenceExceptionRow[] }),
    recurrenceIds.length
      ? supabase
          .from('class_schedule_recurrence_overrides')
          .select('*')
          .eq('org_id', orgId)
          .in('recurrence_id', recurrenceIds)
          .returns<ClassScheduleRecurrenceOverrideRow[]>()
      : Promise.resolve({ data: [] as ClassScheduleRecurrenceOverrideRow[] }),
  ]);

  if ('error' in exceptionsResponse && exceptionsResponse.error) {
    throw new Error(exceptionsResponse.error.message);
  }
  if ('error' in overridesResponse && overridesResponse.error) {
    throw new Error(overridesResponse.error.message);
  }

  const exceptionsByRecurrence = groupBy(
    exceptionsResponse.data ?? [],
    (row) => row.recurrence_id,
  );
  const overridesByRecurrence = groupBy(
    overridesResponse.data ?? [],
    (row) => row.recurrence_id,
  );
  const recurrenceBySchedule = new Map(
    (recurrences ?? []).map((row) => [row.schedule_id, row]),
  );

  return schedules.map((schedule) => {
    const recurrence = recurrenceBySchedule.get(schedule.id);
    if (!recurrence) {
      const timezone = schedule.timezone ?? 'UTC';
      const startTime = getTimeFromISOInTimezone(schedule.start_at, timezone) ?? '09:00';
      const endTime = getTimeFromISOInTimezone(schedule.end_at, timezone) ?? '10:00';
      return {
        id: schedule.id,
        startDate: createFormDateFromIsoInTimezone(schedule.start_at, timezone),
        startTime,
        endTime,
        timezone,
        rule: undefined,
        exceptions: [],
        overrides: [],
      } satisfies RecurrenceFormData;
    }

    const canonical = buildCanonicalLearningSpaceScheduleFromExisting({
      id: schedule.id,
      title: schedule.title,
      startAt: schedule.start_at,
      endAt: schedule.end_at,
      timezone: schedule.timezone ?? null,
      recurrence,
      exceptions: (exceptionsByRecurrence.get(recurrence.id) ?? []).map((exception) => ({
        occurrenceKey: exception.occurrence_key,
        reason: exception.reason ?? null,
      })),
      overrides: (overridesByRecurrence.get(recurrence.id) ?? []).map((override) => ({
        occurrenceKey: override.occurrence_key,
        ...parseOverridePatchForDetail((override.patch ?? {}) as Record<string, unknown>),
      })),
    });
    const timezone = canonical.timezone;
    const expectedLocalStartTime =
      canonical.recurrence.weekdayTimes[0]?.time ?? canonical.displayTime;
    const resolvedCanonicalStart = resolveStoredScheduleDateTimeForForm(
      canonical.startAt,
      timezone,
      expectedLocalStartTime,
    );
    const resolvedCanonicalEnd = resolveStoredScheduleDateTimeForForm(
      canonical.endAt,
      timezone,
    );
    const byWeekday = canonical.recurrence.byday.filter(isWeekday) as WeekdayVM[];
    const rawExceptions = (exceptionsByRecurrence.get(recurrence.id) ?? []).map(
      (exception) => ({
        occurrenceKey: exception.occurrence_key,
        reason: exception.reason ?? null,
      }),
    );
    const rawOverrides = (overridesByRecurrence.get(recurrence.id) ?? []).map(
      (override) => ({
        occurrenceKey: override.occurrence_key,
        ...parseOverridePatchForDetail((override.patch ?? {}) as Record<string, unknown>),
      }),
    );

    return {
      id: schedule.id,
      startDate:
        normalizeScheduleFormDate(resolvedCanonicalStart.date, timezone) ??
        createFormDateFromIsoInTimezone(canonical.startAt, timezone),
      startTime: resolvedCanonicalStart.time ?? canonical.displayTime,
      endTime: resolvedCanonicalEnd.time ?? canonical.displayTime,
      timezone,
      rule: {
        frequency: canonical.recurrence.frequency as NonNullable<
          RecurrenceFormData['rule']
        >['frequency'],
        interval: canonical.recurrence.interval ?? undefined,
        byWeekday: byWeekday ?? undefined,
        weekdayTimes: canonical.recurrence.weekdayTimes.length
          ? canonical.recurrence.weekdayTimes.map((entry) => ({
              day: entry.day as WeekdayVM,
              time: entry.time,
            }))
          : undefined,
        count: canonical.recurrence.count ?? undefined,
        until: canonical.recurrence.until ?? undefined,
        timezone: canonical.recurrence.timezone ?? undefined,
        byMonthDay: canonical.recurrence.bymonthday.length
          ? [...canonical.recurrence.bymonthday]
          : undefined,
        bySetPos: canonical.recurrence.bysetpos.length
          ? [...canonical.recurrence.bysetpos]
          : undefined,
        byMonth: canonical.recurrence.bymonth.length
          ? [...canonical.recurrence.bymonth]
          : undefined,
        monthlyMode:
          canonical.recurrence.frequency === 'monthly'
            ? canonical.recurrence.bysetpos.length
              ? 'weekday_of_month'
              : 'day_of_month'
            : undefined,
        yearlyMode:
          canonical.recurrence.frequency === 'yearly'
            ? canonical.recurrence.bysetpos.length
              ? 'weekday_of_month'
              : 'date_of_month'
            : undefined,
      },
      exceptions: rawExceptions.map((exception, index) => ({
        id: `${schedule.id}:exception:${index}`,
        date:
          resolveStoredOccurrenceDateForForm(
            exception.occurrenceKey,
            timezone,
            canonical.displayTime,
          ) ?? exception.occurrenceKey.slice(0, 10),
        reason: exception.reason ?? undefined,
      })),
      overrides: rawOverrides.map((override, index) => {
        const resolvedOccurrence = resolveStoredScheduleDateTimeForForm(
          override.occurrenceKey,
          timezone,
          canonical.displayTime,
        );
        const originalDate =
          resolvedOccurrence.date ?? override.occurrenceKey.slice(0, 10);
        const newDate = (() => {
          if (!override.startAt) {
            return originalDate;
          }
          const resolvedStart = resolveStoredScheduleDateTimeForForm(
            override.startAt,
            timezone,
            canonical.displayTime,
          );
          return resolvedStart.date ?? override.occurrenceKey.slice(0, 10);
        })();
        const newTime = (() => {
          if (!override.startAt) {
            return canonical.displayTime;
          }
          const resolvedStart = resolveStoredScheduleDateTimeForForm(
            override.startAt,
            timezone,
            canonical.displayTime,
          );
          return resolvedStart.time ?? canonical.displayTime;
        })();

        return {
          id: `${schedule.id}:override:${index}`,
          originalDate,
          newDate,
          newTime,
          reason: override.reason ?? undefined,
        };
      }),
    } satisfies RecurrenceFormData;
  });
}

function groupBy<T, K extends string>(rows: T[], getKey: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
}
