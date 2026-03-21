import { parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

import { DEFAULT_TIMEZONE, getTimezoneDisplayLabel } from './timezones';

export type DateTimeStylePreset =
  | 'natural'
  | 'short'
  | 'weekdayTimeWithZone'
  | 'weekdayAndTimeWithZone';

export type DateStylePreset = 'natural' | 'short' | 'weekdayLong';
export type TimeStylePreset = 'short' | 'withZone' | 'withSeconds';

const DATE_TIME_PATTERNS: Record<DateTimeStylePreset, string> = {
  natural: "MMM d 'at' h:mm a",
  short: 'MMM d, yyyy h:mm a',
  weekdayTimeWithZone: 'EEE h:mm a',
  weekdayAndTimeWithZone: 'EEEE, MMM d, yyyy h:mm a',
};

const DATE_PATTERNS: Record<DateStylePreset, string> = {
  natural: 'MMM d, yyyy',
  short: 'MMM d',
  weekdayLong: 'EEEE, MMM d',
};

const TIME_PATTERNS: Record<TimeStylePreset, string> = {
  short: 'h:mm a',
  withZone: 'h:mm a',
  withSeconds: 'h:mm:ss a',
};

function appendTimezoneLabel(value: string, timezone: string, includeTimezone: boolean) {
  if (!includeTimezone) {
    return value;
  }
  return `${value} ${getTimezoneDisplayLabel(timezone)}`;
}

export function isValidTimezone(value?: string | null) {
  if (!value || !value.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveViewerTimezone(
  profileTz?: string | null,
  browserTz?: string | null,
) {
  if (isValidTimezone(profileTz)) {
    return profileTz as string;
  }
  if (isValidTimezone(browserTz)) {
    return browserTz as string;
  }
  return DEFAULT_TIMEZONE;
}

function parseIsoUtc(value: string) {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function toZonedDateTime(isoUtc: string, timezone: string) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return null;
  }
  const zone = resolveViewerTimezone(timezone);
  return toZonedTime(utcDate, zone);
}

function normalizeLocalDateInput(value: Date | string) {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(
      value.getUTCDate(),
    ).padStart(2, '0')}`;
  }
  return value;
}

function normalizeTimeInput(value: string) {
  const [hourText, minuteText] = value.split(':');
  const hour = Number.parseInt(hourText ?? '', 10);
  const minute = Number.parseInt(minuteText ?? '', 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  const clampedHour = Math.max(0, Math.min(23, hour));
  const clampedMinute = Math.max(0, Math.min(59, minute));
  return `${String(clampedHour).padStart(2, '0')}:${String(clampedMinute).padStart(2, '0')}`;
}

export function toUtcFromLocal(
  localDate: Date | string,
  localTime: string,
  timezone: string,
) {
  const dateText = normalizeLocalDateInput(localDate);
  const timeText = normalizeTimeInput(localTime);
  if (!timeText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }

  const zone = resolveViewerTimezone(timezone);
  const utcDate = fromZonedTime(`${dateText}T${timeText}:00`, zone);
  if (Number.isNaN(utcDate.getTime())) {
    return null;
  }
  return utcDate.toISOString();
}

export function formatDateTime(
  isoUtc: string,
  timezone: string,
  stylePreset: DateTimeStylePreset = 'short',
) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return undefined;
  }
  const zone = resolveViewerTimezone(timezone);
  return appendTimezoneLabel(
    formatInTimeZone(utcDate, zone, DATE_TIME_PATTERNS[stylePreset]),
    zone,
    stylePreset === 'weekdayTimeWithZone' || stylePreset === 'weekdayAndTimeWithZone',
  );
}

export function formatDate(
  isoUtc: string,
  timezone: string,
  stylePreset: DateStylePreset = 'natural',
) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return undefined;
  }
  const zone = resolveViewerTimezone(timezone);
  return formatInTimeZone(utcDate, zone, DATE_PATTERNS[stylePreset]);
}

export function formatTime(
  isoUtc: string,
  timezone: string,
  stylePreset: TimeStylePreset = 'short',
) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return undefined;
  }
  const zone = resolveViewerTimezone(timezone);
  return appendTimezoneLabel(
    formatInTimeZone(utcDate, zone, TIME_PATTERNS[stylePreset]),
    zone,
    stylePreset === 'withZone',
  );
}

export function formatDateInTimezone(isoUtc: string, timezone: string) {
  return formatDate(isoUtc, timezone, 'natural');
}

export function formatTimeInTimezone(isoUtc: string, timezone: string) {
  return formatTime(isoUtc, timezone, 'short');
}

export function isOvernight(startLocalTime: string, endLocalTime: string) {
  const normalizedStart = normalizeTimeInput(startLocalTime);
  const normalizedEnd = normalizeTimeInput(endLocalTime);
  if (!normalizedStart || !normalizedEnd) {
    return false;
  }

  return normalizedEnd <= normalizedStart;
}

export function buildOccurrenceKey(
  localDate: string,
  localTime: string,
  timezone: string,
) {
  return toUtcFromLocal(localDate, localTime, timezone);
}

export function getLocalDateParts(isoUtc: string, timezone: string) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return null;
  }

  const zone = resolveViewerTimezone(timezone);
  return {
    year: formatInTimeZone(utcDate, zone, 'yyyy'),
    month: formatInTimeZone(utcDate, zone, 'MM'),
    day: formatInTimeZone(utcDate, zone, 'dd'),
  };
}

export function getLocalDate(isoUtc: string, timezone: string) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return null;
  }
  return formatInTimeZone(utcDate, resolveViewerTimezone(timezone), 'yyyy-MM-dd');
}

export function getLocalTime(isoUtc: string, timezone: string) {
  const utcDate = parseIsoUtc(isoUtc);
  if (!utcDate) {
    return null;
  }
  return formatInTimeZone(utcDate, resolveViewerTimezone(timezone), 'HH:mm');
}
