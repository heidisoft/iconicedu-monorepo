import type {
  LearningSpaceSchedulePayload,
  LearningSpaceScheduleRulePayload,
  LearningSpaceScheduleWeekdayTimePayload,
  WeekdayVM,
} from '@iconicedu/shared-types';

export const DEFAULT_SCHEDULE_TIME = '09:00';
export const DEFAULT_DURATION_MINUTES = 60;

const WEEKDAY_INDEX: Record<WeekdayVM, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

type ExistingScheduleRecurrenceHashInput = {
  frequency?: string | null;
  interval?: number | null;
  count?: number | null;
  until?: string | null;
  timezone?: string | null;
  bysecond?: number[] | null;
  byminute?: number[] | null;
  byhour?: number[] | null;
  byday?: string[] | null;
  bymonthday?: number[] | null;
  byyearday?: number[] | null;
  byweekno?: number[] | null;
  bymonth?: number[] | null;
  bysetpos?: number[] | null;
  wkst?: string | null;
};

type ExistingScheduleExceptionHashInput = {
  occurrenceKey: string;
  reason?: string | null;
};

type ExistingScheduleOverrideHashInput = {
  occurrenceKey: string;
  startAt?: string | null;
  endAt?: string | null;
  reason?: string | null;
};

export type ExistingLearningSpaceScheduleHashInput = {
  id: string;
  title?: string | null;
  startAt: string;
  endAt: string;
  timezone?: string | null;
  recurrence?: ExistingScheduleRecurrenceHashInput | null;
  exceptions?: ExistingScheduleExceptionHashInput[] | null;
  overrides?: ExistingScheduleOverrideHashInput[] | null;
};

export type LearningSpaceScheduleHashBundle = {
  baseHash: string;
  fullHash: string;
};

export type RRuleFields = {
  bysecond: number[] | null;
  byminute: number[] | null;
  byhour: number[] | null;
  byday: string[] | null;
  bymonthday: number[] | null;
  byyearday: number[] | null;
  byweekno: number[] | null;
  bymonth: number[] | null;
  bysetpos: number[] | null;
  wkst: string;
};

export type CanonicalWeekdayTime = {
  day: string;
  time: string;
};

export type CanonicalScheduleException = {
  occurrenceKey: string;
  reason: string | null;
};

export type CanonicalScheduleOverride = {
  occurrenceKey: string;
  startAt: string | null;
  endAt: string | null;
  reason: string | null;
};

type HashScheduleExceptionSnapshot = {
  occurrenceDate: string | null;
  reason: string | null;
};

type HashScheduleOverrideSnapshot = {
  occurrenceDate: string | null;
  newDate: string | null;
  newTime: string | null;
  durationMinutes: number | null;
  reason: string | null;
};

export type CanonicalScheduleRecurrence = {
  frequency: string;
  interval: number | null;
  count: number | null;
  until: string | null;
  timezone: string;
  bysecond: number[];
  byminute: number[];
  byhour: number[];
  byday: string[];
  bymonthday: number[];
  byyearday: number[];
  byweekno: number[];
  bymonth: number[];
  bysetpos: number[];
  wkst: string | null;
  weekdayTimes: CanonicalWeekdayTime[];
  startAnchorDate: string | null;
};

export type CanonicalLearningSpaceSchedule = {
  id: string | null;
  title: string | null;
  timezone: string;
  startAt: string;
  endAt: string;
  displayTime: string;
  recurrence: CanonicalScheduleRecurrence;
  exceptions: CanonicalScheduleException[];
  overrides: CanonicalScheduleOverride[];
};

export type ExpandedSchedule = {
  startAt: string;
  endAt: string;
  time: string;
};

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeNumberArray(values: number[] | null | undefined) {
  return [...(values ?? [])].filter(Number.isFinite).sort((a, b) => a - b);
}

function normalizeStringArray(values: string[] | null | undefined) {
  return [...(values ?? [])]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort();
}

function normalizeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeObject(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((normalized, key) => {
      const nextValue = normalizeObject(record[key]);
      if (nextValue !== undefined) {
        normalized[key] = nextValue;
      }
      return normalized;
    }, {});
}

export function stableSerialize(value: unknown) {
  return JSON.stringify(normalizeObject(value));
}

function fnv1aHash(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${value.length}`;
}

export function normalizeTimeLabel(value: string) {
  const [hoursText, minutesText] = value.split(':');
  const hours = Number.parseInt(hoursText ?? '', 10);
  const minutes = Number.parseInt(minutesText ?? '', 10);
  const safeHours = Number.isFinite(hours) ? Math.min(Math.max(hours, 0), 23) : 0;
  const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 0), 59) : 0;
  return `${safeHours.toString().padStart(2, '0')}:${safeMinutes
    .toString()
    .padStart(2, '0')}`;
}

export function addMinutesToIso(isoDateTime: string, minutes: number) {
  const date = new Date(isoDateTime);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

export function toOccurrenceKey(isoDate: string, time: string) {
  const [year, month, day] = isoDate.split('-').map((value) => Number(value));
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const date = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0),
  );
  return date.toISOString();
}

function getLocalDateTimePartsInTimezone(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;

  if (!year || !month || !day || !hour || !minute) {
    return null;
  }

  return { year, month, day, hour, minute };
}

export function toOccurrenceKeyInTimezone(
  isoDate: string,
  time: string,
  timezone: string | null | undefined,
) {
  const zone = timezone && timezone.length ? timezone : 'UTC';
  const [yearText, monthText, dayText] = isoDate.split('-');
  const [hourText, minuteText] = normalizeTimeLabel(time).split(':');
  const year = Number(yearText ?? '1970');
  const month = Number(monthText ?? '1');
  const day = Number(dayText ?? '1');
  const hour = Number(hourText ?? '0');
  const minute = Number(minuteText ?? '0');

  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getLocalDateTimePartsInTimezone(new Date(guess).toISOString(), zone);
    if (!actual) {
      break;
    }

    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actualUtc = Date.UTC(
      Number(actual.year),
      Number(actual.month) - 1,
      Number(actual.day),
      Number(actual.hour),
      Number(actual.minute),
      0,
      0,
    );
    const deltaMinutes = Math.round((targetUtc - actualUtc) / 60000);

    if (deltaMinutes === 0) {
      return new Date(guess).toISOString();
    }

    guess += deltaMinutes * 60000;
  }

  return new Date(guess).toISOString();
}

export function getDatePartsInTimezone(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

export function getDateFromISOInTimezone(value: string, timezone: string) {
  const parts = getDatePartsInTimezone(value, timezone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
}

export function getTimeFromISOInTimezone(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function createFormDateFromIsoInTimezone(value: string, timezone: string) {
  const parts = getDatePartsInTimezone(value, timezone);
  if (!parts) {
    return undefined;
  }

  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12, 0, 0, 0),
  );
}

function getUtcWeekdayCode(isoDateTime: string) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return 'MO';
  }

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);

  switch (weekday) {
    case 'Sun':
      return 'SU';
    case 'Mon':
      return 'MO';
    case 'Tue':
      return 'TU';
    case 'Wed':
      return 'WE';
    case 'Thu':
      return 'TH';
    case 'Fri':
      return 'FR';
    case 'Sat':
      return 'SA';
    default:
      return 'MO';
  }
}

function getUtcTimeLabel(isoDateTime: string) {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return DEFAULT_SCHEDULE_TIME;
  }
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function toWeekdayValue(date: Date): WeekdayVM | null {
  const entry = Object.entries(WEEKDAY_INDEX).find(
    ([, index]) => index === date.getUTCDay(),
  );
  return (entry?.[0] as WeekdayVM | undefined) ?? null;
}

function getNextWeekdayDate(startDate: Date, weekday: WeekdayVM) {
  const targetIndex = WEEKDAY_INDEX[weekday] ?? WEEKDAY_INDEX.MO;
  const currentIndex = startDate.getUTCDay();
  const diff = (targetIndex - currentIndex + 7) % 7;
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function applyTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const next = new Date(date);
  next.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

function buildExpandedSchedule(startAtDate: Date, time: string): ExpandedSchedule {
  const startAt = startAtDate.toISOString();
  return {
    startAt,
    endAt: addMinutesToIso(startAt, DEFAULT_DURATION_MINUTES),
    time,
  };
}

function normalizePayloadWeekdayTimes(
  schedule: LearningSpaceSchedulePayload,
): LearningSpaceScheduleWeekdayTimePayload[] {
  if (schedule.rule.weekdayTimes?.length) {
    return [...schedule.rule.weekdayTimes]
      .map((entry) => ({
        day: entry.day,
        time: normalizeTimeLabel(entry.time),
      }))
      .sort((a, b) => `${a.day}:${a.time}`.localeCompare(`${b.day}:${b.time}`));
  }

  if (schedule.rule.byWeekday?.length) {
    return [...schedule.rule.byWeekday]
      .map((day) => ({ day, time: DEFAULT_SCHEDULE_TIME }))
      .sort((a, b) => `${a.day}:${a.time}`.localeCompare(`${b.day}:${b.time}`));
  }

  const fallbackDay = toWeekdayValue(new Date(schedule.startDate));
  return fallbackDay ? [{ day: fallbackDay, time: DEFAULT_SCHEDULE_TIME }] : [];
}

export function buildScheduleStart(
  schedule: LearningSpaceSchedulePayload,
): ExpandedSchedule {
  const startDate = new Date(schedule.startDate);
  startDate.setUTCHours(0, 0, 0, 0);

  const weekdayTimes = normalizePayloadWeekdayTimes(schedule);
  if (!weekdayTimes.length) {
    const startAt = applyTime(startDate, DEFAULT_SCHEDULE_TIME);
    return buildExpandedSchedule(startAt, DEFAULT_SCHEDULE_TIME);
  }

  const candidates = weekdayTimes.map((entry) => {
    const dateForWeekday = getNextWeekdayDate(startDate, entry.day);
    return buildExpandedSchedule(applyTime(dateForWeekday, entry.time), entry.time);
  });

  return candidates.reduce((earliest, candidate) =>
    candidate.startAt < earliest.startAt ? candidate : earliest,
  );
}

export function buildRRuleFields(
  rule: LearningSpaceScheduleRulePayload,
  startDate: string,
): RRuleFields {
  const weekdayTimes = rule.weekdayTimes ?? [];
  const byday = rule.byWeekday?.length
    ? rule.byWeekday
    : weekdayTimes.length
      ? weekdayTimes.map((entry) => entry.day)
      : null;

  const times = weekdayTimes.length
    ? weekdayTimes.map((entry) => normalizeTimeLabel(entry.time))
    : rule.frequency !== 'weekly'
      ? [getUtcTimeLabel(startDate)]
      : [];

  const hours = new Set<number>();
  const minutes = new Set<number>();
  times.forEach((time) => {
    const [hour, minute] = time.split(':').map((value) => Number(value));
    if (!Number.isNaN(hour)) hours.add(hour);
    if (!Number.isNaN(minute)) minutes.add(minute);
  });

  return {
    bysecond: null,
    byminute: minutes.size ? Array.from(minutes).sort((a, b) => a - b) : null,
    byhour: hours.size ? Array.from(hours).sort((a, b) => a - b) : null,
    byday: byday?.length ? Array.from(new Set(byday)).sort() : null,
    bymonthday: null,
    byyearday: null,
    byweekno: null,
    bymonth: null,
    bysetpos: null,
    wkst: 'MO',
  };
}

function buildWeekdayTimesFromRecurrence(input: {
  byday?: string[] | null;
  byhour?: number[] | null;
  byminute?: number[] | null;
  fallbackStartAt: string;
}) {
  const days = normalizeStringArray(input.byday);
  const hours = normalizeNumberArray(input.byhour);
  const minutes = normalizeNumberArray(input.byminute);
  const normalizedDays = days.length ? days : [getUtcWeekdayCode(input.fallbackStartAt)];
  const normalizedHours = hours.length
    ? hours
    : [Number(getUtcTimeLabel(input.fallbackStartAt).slice(0, 2))];
  const normalizedMinutes = minutes.length
    ? minutes
    : [Number(getUtcTimeLabel(input.fallbackStartAt).slice(3, 5))];

  return normalizedDays
    .flatMap((day) =>
      normalizedHours.flatMap((hour) =>
        normalizedMinutes.map((minute) => ({
          day,
          time: `${hour.toString().padStart(2, '0')}:${minute
            .toString()
            .padStart(2, '0')}`,
        })),
      ),
    )
    .sort((a, b) => `${a.day}:${a.time}`.localeCompare(`${b.day}:${b.time}`));
}

function buildCanonicalRecurrenceFromPayload(schedule: LearningSpaceSchedulePayload) {
  const timezone = schedule.timezone ?? schedule.rule.timezone ?? 'UTC';
  const fields = buildRRuleFields(schedule.rule, schedule.startDate);
  const weekdayTimes = buildWeekdayTimesFromRecurrence({
    byday: fields.byday,
    byhour: fields.byhour,
    byminute: fields.byminute,
    fallbackStartAt: buildScheduleStart(schedule).startAt,
  });

  return {
    frequency: schedule.rule.frequency,
    interval: schedule.rule.interval ?? 1,
    count: schedule.rule.count ?? null,
    until: schedule.rule.until ?? null,
    timezone,
    bysecond: normalizeNumberArray(fields.bysecond),
    byminute: normalizeNumberArray(fields.byminute),
    byhour: normalizeNumberArray(fields.byhour),
    byday: normalizeStringArray(fields.byday),
    bymonthday: normalizeNumberArray(fields.bymonthday),
    byyearday: normalizeNumberArray(fields.byyearday),
    byweekno: normalizeNumberArray(fields.byweekno),
    bymonth: normalizeNumberArray(fields.bymonth),
    bysetpos: normalizeNumberArray(fields.bysetpos),
    wkst: fields.wkst ?? null,
    weekdayTimes,
    startAnchorDate:
      schedule.rule.frequency === 'weekly' && weekdayTimes.length > 0
        ? null
        : (getDateFromISOInTimezone(schedule.startDate, timezone) ??
          schedule.startDate.slice(0, 10)),
  } satisfies CanonicalScheduleRecurrence;
}

function buildCanonicalRecurrenceFromExisting(
  input: ExistingLearningSpaceScheduleHashInput,
) {
  const timezone = input.recurrence?.timezone ?? input.timezone ?? 'UTC';
  const frequency = input.recurrence?.frequency ?? 'weekly';
  const fallbackHour = Number(getUtcTimeLabel(input.startAt).slice(0, 2));
  const fallbackMinute = Number(getUtcTimeLabel(input.startAt).slice(3, 5));
  const fallbackDay = getUtcWeekdayCode(input.startAt);
  const weekdayTimes = buildWeekdayTimesFromRecurrence({
    byday: input.recurrence?.byday,
    byhour: input.recurrence?.byhour,
    byminute: input.recurrence?.byminute,
    fallbackStartAt: input.startAt,
  });

  return {
    frequency,
    interval: input.recurrence?.interval ?? 1,
    count: input.recurrence?.count ?? null,
    until: input.recurrence?.until ?? null,
    timezone,
    bysecond: normalizeNumberArray(input.recurrence?.bysecond),
    byminute: normalizeNumberArray(input.recurrence?.byminute).length
      ? normalizeNumberArray(input.recurrence?.byminute)
      : [fallbackMinute],
    byhour: normalizeNumberArray(input.recurrence?.byhour).length
      ? normalizeNumberArray(input.recurrence?.byhour)
      : [fallbackHour],
    byday: normalizeStringArray(input.recurrence?.byday).length
      ? normalizeStringArray(input.recurrence?.byday)
      : [fallbackDay],
    bymonthday: normalizeNumberArray(input.recurrence?.bymonthday),
    byyearday: normalizeNumberArray(input.recurrence?.byyearday),
    byweekno: normalizeNumberArray(input.recurrence?.byweekno),
    bymonth: normalizeNumberArray(input.recurrence?.bymonth),
    bysetpos: normalizeNumberArray(input.recurrence?.bysetpos),
    wkst: input.recurrence?.wkst ?? 'MO',
    weekdayTimes,
    startAnchorDate:
      frequency === 'weekly' && weekdayTimes.length > 0
        ? null
        : (getDateFromISOInTimezone(input.startAt, timezone) ??
          input.startAt.slice(0, 10)),
  } satisfies CanonicalScheduleRecurrence;
}

export function buildCanonicalLearningSpaceScheduleFromPayload(
  schedule: LearningSpaceSchedulePayload,
): CanonicalLearningSpaceSchedule {
  const expanded = buildScheduleStart(schedule);
  const recurrence = buildCanonicalRecurrenceFromPayload(schedule);

  return {
    id: null,
    title: null,
    timezone: recurrence.timezone,
    startAt: expanded.startAt,
    endAt: expanded.endAt,
    displayTime: expanded.time,
    recurrence,
    exceptions: [...(schedule.exceptions ?? [])]
      .map((entry) => ({
        occurrenceKey: toOccurrenceKeyInTimezone(
          entry.date,
          expanded.time,
          recurrence.timezone,
        ),
        reason: normalizeNullableText(entry.reason),
      }))
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
    overrides: [...(schedule.overrides ?? [])]
      .map((entry) => {
        const explicitNewTime = normalizeNullableText(entry.newTime);
        const nextTime =
          explicitNewTime !== null ? normalizeTimeLabel(explicitNewTime) : expanded.time;
        const startAt = toOccurrenceKeyInTimezone(
          entry.newDate,
          nextTime,
          recurrence.timezone,
        );
        return {
          occurrenceKey: toOccurrenceKeyInTimezone(
            entry.originalDate,
            expanded.time,
            recurrence.timezone,
          ),
          startAt,
          endAt: addMinutesToIso(startAt, DEFAULT_DURATION_MINUTES),
          reason: normalizeNullableText(entry.reason),
        };
      })
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
  };
}

export function buildCanonicalLearningSpaceScheduleFromExisting(
  input: ExistingLearningSpaceScheduleHashInput,
): CanonicalLearningSpaceSchedule {
  const recurrence = buildCanonicalRecurrenceFromExisting(input);
  const displayTime =
    getTimeFromISOInTimezone(input.startAt, recurrence.timezone) ??
    getUtcTimeLabel(input.startAt);
  const durationMs = Math.max(
    DEFAULT_DURATION_MINUTES * 60 * 1000,
    new Date(input.endAt).getTime() - new Date(input.startAt).getTime(),
  );
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

  return {
    id: input.id,
    title: input.title ?? null,
    timezone: recurrence.timezone,
    startAt: input.startAt,
    endAt: input.endAt,
    displayTime,
    recurrence,
    exceptions: [...(input.exceptions ?? [])]
      .map((entry) => ({
        occurrenceKey: (() => {
          const normalizedDate = getDateFromISOInTimezone(
            entry.occurrenceKey,
            recurrence.timezone,
          );
          return normalizedDate
            ? toOccurrenceKeyInTimezone(normalizedDate, displayTime, recurrence.timezone)
            : entry.occurrenceKey;
        })(),
        reason: normalizeNullableText(entry.reason),
      }))
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
    overrides: [...(input.overrides ?? [])]
      .map((entry) => ({
        occurrenceKey: (() => {
          const normalizedDate = getDateFromISOInTimezone(
            entry.occurrenceKey,
            recurrence.timezone,
          );
          return normalizedDate
            ? toOccurrenceKeyInTimezone(normalizedDate, displayTime, recurrence.timezone)
            : entry.occurrenceKey;
        })(),
        startAt: (() => {
          const date = entry.startAt
            ? getDateFromISOInTimezone(entry.startAt, recurrence.timezone)
            : getDateFromISOInTimezone(entry.occurrenceKey, recurrence.timezone);
          const time =
            (entry.startAt
              ? getTimeFromISOInTimezone(entry.startAt, recurrence.timezone)
              : null) ?? displayTime;
          return date ? toOccurrenceKeyInTimezone(date, time, recurrence.timezone) : null;
        })(),
        endAt: (() => {
          const date = entry.startAt
            ? getDateFromISOInTimezone(entry.startAt, recurrence.timezone)
            : getDateFromISOInTimezone(entry.occurrenceKey, recurrence.timezone);
          const time =
            (entry.startAt
              ? getTimeFromISOInTimezone(entry.startAt, recurrence.timezone)
              : null) ?? displayTime;
          if (!date) {
            return null;
          }
          const normalizedStartAt = toOccurrenceKeyInTimezone(
            date,
            time,
            recurrence.timezone,
          );
          const explicitDurationMs =
            entry.startAt && entry.endAt
              ? new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()
              : Number.NaN;
          const normalizedDurationMinutes =
            Number.isFinite(explicitDurationMs) && explicitDurationMs > 0
              ? Math.round(explicitDurationMs / 60000)
              : durationMinutes;
          return addMinutesToIso(normalizedStartAt, normalizedDurationMinutes);
        })(),
        reason: normalizeNullableText(entry.reason),
      }))
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))),
  };
}

function buildCanonicalBaseSnapshot(schedule: CanonicalLearningSpaceSchedule) {
  return {
    recurrence: schedule.recurrence,
  };
}

function normalizeExceptionForHash(
  exception: CanonicalScheduleException,
  timezone: string,
): HashScheduleExceptionSnapshot {
  return {
    occurrenceDate: getDateFromISOInTimezone(exception.occurrenceKey, timezone),
    reason: normalizeNullableText(exception.reason),
  };
}

function normalizeOverrideForHash(
  override: CanonicalScheduleOverride,
  timezone: string,
): HashScheduleOverrideSnapshot {
  const newDate = override.startAt
    ? getDateFromISOInTimezone(override.startAt, timezone)
    : null;
  const newTime = override.startAt
    ? getTimeFromISOInTimezone(override.startAt, timezone)
    : null;
  let durationMinutes: number | null = null;
  if (override.startAt && override.endAt) {
    const minutes = Math.round(
      (new Date(override.endAt).getTime() - new Date(override.startAt).getTime()) / 60000,
    );
    durationMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }

  return {
    occurrenceDate: getDateFromISOInTimezone(override.occurrenceKey, timezone),
    newDate,
    newTime,
    durationMinutes,
    reason: normalizeNullableText(override.reason),
  };
}

function buildCanonicalFullSnapshot(schedule: CanonicalLearningSpaceSchedule) {
  const timezone = schedule.recurrence.timezone ?? schedule.timezone ?? 'UTC';
  const normalizedExceptions = schedule.exceptions
    .map((exception) => normalizeExceptionForHash(exception, timezone))
    .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b)));
  const normalizedOverrides = schedule.overrides
    .map((override) => normalizeOverrideForHash(override, timezone))
    .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b)));

  return {
    recurrence: schedule.recurrence,
    exceptions: normalizedExceptions,
    overrides: normalizedOverrides,
  };
}

function buildHashBundleFromCanonical(
  schedule: CanonicalLearningSpaceSchedule,
): LearningSpaceScheduleHashBundle {
  return {
    baseHash: fnv1aHash(stableSerialize(buildCanonicalBaseSnapshot(schedule))),
    fullHash: fnv1aHash(stableSerialize(buildCanonicalFullSnapshot(schedule))),
  };
}

export function buildLearningSpaceScheduleHashBundleFromCanonical(
  schedule: CanonicalLearningSpaceSchedule,
): LearningSpaceScheduleHashBundle {
  return buildHashBundleFromCanonical(schedule);
}

function sortCanonicalSchedules(
  schedules: CanonicalLearningSpaceSchedule[],
): CanonicalLearningSpaceSchedule[] {
  return [...schedules].sort((a, b) => {
    const aHashes = buildHashBundleFromCanonical(a);
    const bHashes = buildHashBundleFromCanonical(b);
    return stableSerialize([
      aHashes.baseHash,
      aHashes.fullHash,
      a.startAt,
      a.endAt,
      a.displayTime,
    ]).localeCompare(
      stableSerialize([
        bHashes.baseHash,
        bHashes.fullHash,
        b.startAt,
        b.endAt,
        b.displayTime,
      ]),
    );
  });
}

export function buildCanonicalLearningSpaceSchedulesFromPayload(
  schedules: LearningSpaceSchedulePayload[] | null | undefined,
) {
  return sortCanonicalSchedules(
    [...(schedules ?? [])].map((schedule) =>
      buildCanonicalLearningSpaceScheduleFromPayload(schedule),
    ),
  );
}

export function buildCanonicalLearningSpaceSchedulesFromExisting(
  schedules: ExistingLearningSpaceScheduleHashInput[],
) {
  return sortCanonicalSchedules(
    schedules.map((schedule) =>
      buildCanonicalLearningSpaceScheduleFromExisting(schedule),
    ),
  );
}

export function buildLearningSpaceScheduleHashBundleFromPayload(
  schedule: LearningSpaceSchedulePayload,
): LearningSpaceScheduleHashBundle {
  return buildHashBundleFromCanonical(
    buildCanonicalLearningSpaceScheduleFromPayload(schedule),
  );
}

export function buildLearningSpaceScheduleHashBundleFromExisting(
  input: ExistingLearningSpaceScheduleHashInput,
): LearningSpaceScheduleHashBundle {
  return buildHashBundleFromCanonical(
    buildCanonicalLearningSpaceScheduleFromExisting(input),
  );
}

export function buildLearningSpaceSchedulesHashKeyFromPayload(
  schedules: LearningSpaceSchedulePayload[] | null | undefined,
) {
  const bundles = buildCanonicalLearningSpaceSchedulesFromPayload(schedules).map(
    (schedule) => buildHashBundleFromCanonical(schedule),
  );
  return fnv1aHash(stableSerialize(bundles));
}

export function buildLearningSpaceSchedulesHashKeyFromExisting(
  schedules: ExistingLearningSpaceScheduleHashInput[],
) {
  const bundles = buildCanonicalLearningSpaceSchedulesFromExisting(schedules).map(
    (schedule) => buildHashBundleFromCanonical(schedule),
  );
  return fnv1aHash(stableSerialize(bundles));
}
