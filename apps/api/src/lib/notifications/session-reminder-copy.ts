import { getLocalDate, resolveViewerTimezone } from '@iconicedu/utils';

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function addOneDay(localDate: string) {
  const [yearText, monthText, dayText] = localDate.split('-');
  const year = Number.parseInt(yearText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const day = Number.parseInt(dayText ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(
    next.getUTCDate(),
  ).padStart(2, '0')}`;
}

function formatDateLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatTimeLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function resolveSessionReminderDisplayTimezone(payload: Record<string, unknown>) {
  return resolveViewerTimezone(
    asOptionalString(payload.viewerTimezone) ??
      asOptionalString(payload.recipientTimezone) ??
      asOptionalString(payload.timezone) ??
      asOptionalString(payload.firstSessionTimezone),
  );
}

export function formatSessionReminderStartCopy(input: {
  startAt?: string | null;
  payload: Record<string, unknown>;
  now?: Date;
}) {
  if (!input.startAt) {
    return undefined;
  }

  const startDate = new Date(input.startAt);
  if (Number.isNaN(startDate.getTime())) {
    return undefined;
  }

  const timezone = resolveSessionReminderDisplayTimezone(input.payload);
  const now = input.now ?? new Date();
  const startLocalDate = getLocalDate(input.startAt, timezone);
  const nowLocalDate = getLocalDate(now.toISOString(), timezone);
  const tomorrowLocalDate = nowLocalDate ? addOneDay(nowLocalDate) : null;
  const timeLabel = formatTimeLabel(startDate, timezone);

  if (startLocalDate && nowLocalDate && startLocalDate === nowLocalDate) {
    return `Class session starts today at ${timeLabel}`;
  }

  if (startLocalDate && tomorrowLocalDate && startLocalDate === tomorrowLocalDate) {
    return `Class session starts tomorrow at ${timeLabel}`;
  }

  return `Class session starts ${formatDateLabel(startDate, timezone)} at ${timeLabel}`;
}
