import type {
  ClassScheduleRecurrenceExceptionRow,
  ClassScheduleRecurrenceOverrideRow,
  ClassScheduleRecurrenceRow,
  ClassScheduleRow,
  LearningSpaceLinkRow,
  LearningSpaceLinkVM,
  LearningSpaceParticipantRow,
  LearningSpaceRow,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { RecurrenceFormData, WeekdayVM } from '@iconicedu/ui-web/lib/recurrence-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapLearningSpaceLinkRow } from '@iconicedu/web/lib/spaces/mappers/learning-space.mapper';

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
    themeKey: string | null;
  };
  participants: UserProfileVM[];
  resources: LearningSpaceLinkVM[];
  schedules: RecurrenceFormData[];
};

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
    throw new Error('Learning space not found');
  }

  const [participantsResponse, linksResponse, schedulesResponse, channelLinksResponse] = await Promise.all([
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
  let channelThemeKey: string | null = null;
  if (primaryChannelId) {
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('ui_theme_key')
      .eq('org_id', orgId)
      .eq('id', primaryChannelId)
      .is('deleted_at', null)
      .maybeSingle<{ ui_theme_key?: string | null }>();

    if (channelError) {
      throw new Error(channelError.message);
    }
    channelThemeKey = channel?.ui_theme_key ?? null;
  }

  const participantProfiles = await Promise.all(
    (participantsResponse.data ?? []).map((row) => buildUserProfileById(supabase, row.profile_id)),
  );
  const participants = participantProfiles.filter(
    (profile): profile is UserProfileVM => Boolean(profile),
  );

  const schedules = await buildSchedulesForForm(supabase, orgId, schedulesResponse.data ?? []);

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
    },
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

  const exceptionsByRecurrence = groupBy(exceptionsResponse.data ?? [], (row) => row.recurrence_id);
  const overridesByRecurrence = groupBy(overridesResponse.data ?? [], (row) => row.recurrence_id);
  const recurrenceBySchedule = new Map(
    (recurrences ?? []).map((row) => [row.schedule_id, row]),
  );

  return schedules.map((schedule) => {
    const recurrence = recurrenceBySchedule.get(schedule.id);
    if (!recurrence) {
      return {
        id: schedule.id,
        startDate: new Date(schedule.start_at),
        timezone: schedule.timezone ?? 'UTC',
        rule: {
          frequency: 'weekly',
          interval: 1,
        },
        exceptions: [],
        overrides: [],
      } satisfies RecurrenceFormData;
    }

    const byWeekday = recurrence.byday?.filter(isWeekday) ?? undefined;
    const weekdayTimes = byWeekday?.map((day) => ({
      day: day as 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU',
      time: getTimeFromISO(schedule.start_at),
    }));

    const exceptions = (exceptionsByRecurrence.get(recurrence.id) ?? []).map((exception) => ({
      id: exception.id,
      date: getDateFromISO(exception.occurrence_key),
      reason: exception.reason ?? undefined,
    }));

    const overrides = (overridesByRecurrence.get(recurrence.id) ?? []).map((override) => {
      const patch = (override.patch ?? {}) as Record<string, unknown>;
      const startAt = typeof patch.startAt === 'string' ? patch.startAt : null;
      const newDate = startAt ? getDateFromISO(startAt) : getDateFromISO(override.occurrence_key);
      const newTime = startAt ? getTimeFromISO(startAt) : getTimeFromISO(override.occurrence_key);

      return {
        id: override.id,
        originalDate: getDateFromISO(override.occurrence_key),
        newDate,
        newTime,
        reason: typeof patch.reason === 'string' ? patch.reason : undefined,
      };
    });

    return {
      id: schedule.id,
      startDate: new Date(schedule.start_at),
      timezone: recurrence.timezone ?? schedule.timezone ?? 'UTC',
      rule: {
        frequency: recurrence.frequency as RecurrenceFormData['rule']['frequency'],
        interval: recurrence.interval ?? undefined,
        byWeekday: byWeekday ?? undefined,
        weekdayTimes: weekdayTimes?.length ? weekdayTimes : undefined,
        count: recurrence.count ?? undefined,
        until: recurrence.until ?? undefined,
        timezone: recurrence.timezone ?? undefined,
      },
      exceptions,
      overrides,
    } satisfies RecurrenceFormData;
  });
}

function getDateFromISO(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getTimeFromISO(value: string) {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
