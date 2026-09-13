import type {
  AdminJobActivityRecordVM,
  AdminJobActivityStatusCountVM,
} from '@iconicedu/shared-types';

export type JobActivityBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export type JobActivityTone = 'success' | 'destructive' | 'warning' | 'info' | 'muted';

const SUCCESS_STATUSES = new Set([
  'succeeded',
  'confirmed',
  'auto_confirmed',
  'resolved',
  'rated',
  'idempotent_hit',
]);
const IN_FLIGHT_STATUSES = new Set(['pending', 'leased', 'notified']);
const FAILED_STATUSES = new Set(['failed', 'dead_letter', 'fatal_failure', 'disputed']);
const WARNING_STATUSES = new Set(['retryable_failure', 'canceled']);
const MUTED_STATUSES = new Set(['suppressed', 'expired', 'skipped']);

export function jobActivityStatusVariant(status: string): JobActivityBadgeVariant {
  switch (jobActivityStatusTone(status)) {
    case 'success':
      return 'default';
    case 'destructive':
      return 'destructive';
    case 'info':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function jobActivityStatusTone(status: string): JobActivityTone {
  const normalized = status.toLowerCase();
  if (SUCCESS_STATUSES.has(normalized)) return 'success';
  if (FAILED_STATUSES.has(normalized)) return 'destructive';
  if (WARNING_STATUSES.has(normalized)) return 'warning';
  if (IN_FLIGHT_STATUSES.has(normalized)) return 'info';
  if (MUTED_STATUSES.has(normalized)) return 'muted';
  return 'muted';
}

/** Tailwind background utility for a status tone (semantic palette tokens only). */
export const JOB_ACTIVITY_TONE_BG: Record<JobActivityTone, string> = {
  success: 'bg-success',
  destructive: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
  muted: 'bg-muted-foreground/50',
};

export type JobActivityChartSegment = {
  status: string;
  count: number;
  tone: JobActivityTone;
  /** Share of the total, 0–100. */
  percent: number;
};

export function buildJobActivityStatusSegments(
  statusCounts: AdminJobActivityStatusCountVM[],
): { segments: JobActivityChartSegment[]; total: number } {
  const total = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
  const segments = statusCounts
    .map((entry) => ({
      status: entry.status,
      count: entry.count,
      tone: jobActivityStatusTone(entry.status),
      percent: total === 0 ? 0 : (entry.count / total) * 100,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.status.localeCompare(right.status),
    );
  return { segments, total };
}

export function formatJobActivityDateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', { timeZone: 'UTC' });
}

export function formatJobActivityAttempts(
  record: Pick<AdminJobActivityRecordVM, 'attemptCount' | 'maxAttempts'>,
): string {
  if (record.attemptCount === null) return '—';
  if (record.maxAttempts === null) return String(record.attemptCount);
  return `${record.attemptCount} / ${record.maxAttempts}`;
}

export type JobActivityVolumeBucket = {
  key: string;
  label: string;
  count: number;
};

export type JobActivityVolume = {
  granularity: 'hour' | 'day' | 'week';
  buckets: JobActivityVolumeBucket[];
  total: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfHour(date: Date): Date {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}
function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

/**
 * Buckets the sampled records by their `createdAt` timestamp. Granularity adapts
 * to the span the sample covers so the chart stays readable for both bursty and
 * slow-moving queues.
 */
export function buildJobActivityVolume(
  records: Pick<AdminJobActivityRecordVM, 'createdAt'>[],
): JobActivityVolume {
  const times = records
    .map((record) => new Date(record.createdAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right);

  if (!times.length) {
    return { granularity: 'day', buckets: [], total: 0 };
  }

  const span = times[times.length - 1] - times[0];
  const granularity: JobActivityVolume['granularity'] =
    span <= 36 * HOUR_MS ? 'hour' : span <= 60 * DAY_MS ? 'day' : 'week';

  const stepMs =
    granularity === 'hour' ? HOUR_MS : granularity === 'day' ? DAY_MS : 7 * DAY_MS;
  const floor = (date: Date) =>
    granularity === 'hour'
      ? startOfHour(date)
      : granularity === 'day'
        ? startOfDay(date)
        : startOfWeek(date);

  const first = floor(new Date(times[0])).getTime();
  const last = floor(new Date(times[times.length - 1])).getTime();

  const counts = new Map<number, number>();
  for (const time of times) {
    const bucketStart = floor(new Date(time)).getTime();
    counts.set(bucketStart, (counts.get(bucketStart) ?? 0) + 1);
  }

  const buckets: JobActivityVolumeBucket[] = [];
  const maxBuckets = 24;
  const start = Math.max(first, last - (maxBuckets - 1) * stepMs);
  for (let cursor = start; cursor <= last; cursor += stepMs) {
    const date = new Date(cursor);
    buckets.push({
      key: date.toISOString(),
      label:
        granularity === 'hour'
          ? date.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' })
          : date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            }),
      count: counts.get(cursor) ?? 0,
    });
  }

  return {
    granularity,
    buckets,
    total: times.length,
  };
}

export function filterJobActivityRecords(
  records: AdminJobActivityRecordVM[],
  input: { search: string; status: string },
): AdminJobActivityRecordVM[] {
  const normalizedSearch = input.search.trim().toLowerCase();

  return records.filter((record) => {
    if (input.status !== 'all' && record.status !== input.status) {
      return false;
    }

    if (!normalizedSearch) return true;

    return [
      record.label,
      record.message,
      record.detail,
      record.status,
      record.priority,
      record.lastError,
      record.id,
      ...record.participants,
    ].some((field) => field?.toLowerCase().includes(normalizedSearch));
  });
}
