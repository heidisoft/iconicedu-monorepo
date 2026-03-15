export const DEFAULT_SCHEDULE_DISPLAY_TIMEZONE = 'UTC';

export interface ScheduleDisplayTimeZoneOptions {
  viewerTimezone?: string | null;
  scheduleTimezone?: string | null;
  allowBrowserFallback?: boolean;
}

export type ScheduleDisplayTimeZoneInput =
  | string
  | null
  | undefined
  | ScheduleDisplayTimeZoneOptions;

function normalizeTimeZone(timezone?: string | null) {
  const value = timezone?.trim();
  return value ? value : null;
}

function isScheduleDisplayTimeZoneOptions(
  value: ScheduleDisplayTimeZoneInput,
): value is ScheduleDisplayTimeZoneOptions {
  return typeof value === 'object' && value !== null;
}

function normalizeScheduleDisplayTimeZoneInput(input?: ScheduleDisplayTimeZoneInput) {
  if (isScheduleDisplayTimeZoneOptions(input)) {
    return {
      viewerTimezone: normalizeTimeZone(input.viewerTimezone),
      scheduleTimezone: normalizeTimeZone(input.scheduleTimezone),
      allowBrowserFallback: input.allowBrowserFallback ?? true,
    };
  }

  return {
    viewerTimezone: normalizeTimeZone(input),
    scheduleTimezone: null,
    allowBrowserFallback: true,
  };
}

export function isValidScheduleDisplayTimeZone(timezone?: string | null): boolean {
  const candidate = normalizeTimeZone(timezone);
  if (!candidate) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getBrowserScheduleDisplayTimeZone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidScheduleDisplayTimeZone(timezone) ? timezone : null;
  } catch {
    return null;
  }
}

export function resolveScheduleDisplayTimeZone(
  input?: ScheduleDisplayTimeZoneInput,
): string {
  const normalized = normalizeScheduleDisplayTimeZoneInput(input);

  if (isValidScheduleDisplayTimeZone(normalized.viewerTimezone)) {
    return normalized.viewerTimezone!;
  }

  if (isValidScheduleDisplayTimeZone(normalized.scheduleTimezone)) {
    return normalized.scheduleTimezone!;
  }

  const browserTimeZone =
    normalized.allowBrowserFallback && typeof window !== 'undefined'
      ? getBrowserScheduleDisplayTimeZone()
      : null;
  if (browserTimeZone) {
    return browserTimeZone;
  }

  return DEFAULT_SCHEDULE_DISPLAY_TIMEZONE;
}

function toDate(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildFormatter(
  timezone: ScheduleDisplayTimeZoneInput,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveScheduleDisplayTimeZone(timezone),
    ...options,
  });
}

export function formatScheduleDisplayValue(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
  options: Intl.DateTimeFormatOptions,
) {
  const date = toDate(input);
  if (!date) {
    return null;
  }

  return buildFormatter(timezone, options).format(date);
}

export function getScheduleDisplayDateParts(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const date = toDate(input);
  if (!date) {
    return null;
  }

  const formatter = buildFormatter(timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? null;

  const year = Number(lookup('year'));
  const month = Number(lookup('month'));
  const day = Number(lookup('day'));
  const hour = Number(lookup('hour'));
  const minute = Number(lookup('minute'));
  const weekdayShort = lookup('weekday');

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekdayShort: weekdayShort ?? undefined,
  };
}

export function toScheduleDisplayDate(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const parts = getScheduleDisplayDateParts(input, timezone);
  if (!parts) {
    return null;
  }

  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

export function getScheduleDisplayDayKey(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const parts = getScheduleDisplayDateParts(input, timezone);
  if (!parts) {
    return null;
  }

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getScheduleDisplayMonthKey(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const parts = getScheduleDisplayDateParts(input, timezone);
  if (!parts) {
    return null;
  }

  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function getScheduleDisplayMinutes(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const parts = getScheduleDisplayDateParts(input, timezone);
  if (!parts) {
    return 0;
  }

  return parts.hour * 60 + parts.minute;
}

export function isSameScheduleDisplayDay(
  left: Date | string,
  right: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const leftKey = getScheduleDisplayDayKey(left, timezone);
  const rightKey = getScheduleDisplayDayKey(right, timezone);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function getScheduleDisplayTimeZoneAbbreviation(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const date = toDate(input);
  if (!date) {
    return null;
  }

  const formatter = buildFormatter(timezone, {
    timeZoneName: 'short',
  });
  const part = formatter
    .formatToParts(date)
    .find((entry) => entry.type === 'timeZoneName')?.value;
  return part ?? null;
}

export function formatScheduleDisplayTimeWithZone(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
  options: Intl.DateTimeFormatOptions,
) {
  const formatted = formatScheduleDisplayValue(input, timezone, options);
  if (!formatted) {
    return null;
  }

  const abbreviation = getScheduleDisplayTimeZoneAbbreviation(input, timezone);
  if (!abbreviation) {
    return formatted;
  }

  return `${formatted} ${abbreviation}`;
}
