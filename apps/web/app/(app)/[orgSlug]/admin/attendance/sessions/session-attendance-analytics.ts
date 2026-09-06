import type { LiveSessionAttendanceListItemVM } from '@iconicedu/shared-types';

export type AttendanceFilters = {
  search: string;
  month: string;
  teacherId: string;
  parentId: string;
  status: string;
  scope: string;
};

export type AttendanceTrendPoint = {
  key: string;
  label: string;
  sessions: number;
  attendanceRate: number | null;
};

export function getAttendanceMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatAttendanceMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function filterAttendanceRows(
  rows: LiveSessionAttendanceListItemVM[],
  filters: AttendanceFilters,
) {
  const query = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (filters.month !== 'all' && getAttendanceMonthKey(row.startedAt) !== filters.month)
      return false;
    if (filters.teacherId !== 'all' && row.startedBy?.ids.id !== filters.teacherId)
      return false;
    if (
      filters.parentId !== 'all' &&
      !(row.participants ?? []).some((profile) => profile.ids.id === filters.parentId)
    )
      return false;
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (filters.scope !== 'all' && row.scope !== filters.scope) return false;
    if (!query) return true;

    return [
      row.learningSpaceTitle,
      row.channelTopic,
      row.startedBy?.profile.displayName,
      ...(row.participants ?? []).map((profile) => profile.profile.displayName),
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function summarizeAttendance(rows: LiveSessionAttendanceListItemVM[]) {
  const completed = rows.filter((row) => row.status === 'ended');
  const expected = completed.reduce(
    (sum, row) => sum + row.metrics.expectedParticipantCount,
    0,
  );
  const attendees = completed.reduce((sum, row) => sum + row.metrics.attendeeCount, 0);
  const full = completed.reduce((sum, row) => sum + row.metrics.fullAttendanceCount, 0);
  const noShows = completed.reduce((sum, row) => sum + row.metrics.noShowCount, 0);

  return {
    completedSessions: completed.length,
    attendanceRate: expected ? attendees / expected : null,
    fullAttendanceRate: expected ? full / expected : null,
    noShows,
  };
}

export function buildMonthlyAttendanceTrend(
  rows: LiveSessionAttendanceListItemVM[],
): AttendanceTrendPoint[] {
  const buckets = new Map<
    string,
    { sessions: number; expected: number; attendees: number }
  >();
  rows
    .filter((row) => row.status === 'ended')
    .forEach((row) => {
      const key = getAttendanceMonthKey(row.startedAt);
      if (!key) return;
      const bucket = buckets.get(key) ?? { sessions: 0, expected: 0, attendees: 0 };
      bucket.sessions += 1;
      bucket.expected += row.metrics.expectedParticipantCount;
      bucket.attendees += row.metrics.attendeeCount;
      buckets.set(key, bucket);
    });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([key, value]) => ({
      key,
      label: formatAttendanceMonth(key),
      sessions: value.sessions,
      attendanceRate: value.expected ? value.attendees / value.expected : null,
    }));
}

export function buildPersonBreakdown(
  rows: LiveSessionAttendanceListItemVM[],
  kind: 'teacher' | 'parent',
) {
  const people = new Map<string, { name: string; sessions: number }>();
  rows
    .filter((row) => row.status === 'ended')
    .forEach((row) => {
      const profiles =
        kind === 'teacher'
          ? row.startedBy
            ? [row.startedBy]
            : []
          : (row.participants ?? []).filter((profile) => profile.kind === 'guardian');
      new Map(profiles.map((profile) => [profile.ids.id, profile])).forEach((profile) => {
        const current = people.get(profile.ids.id) ?? {
          name: profile.profile.displayName,
          sessions: 0,
        };
        current.sessions += 1;
        people.set(profile.ids.id, current);
      });
    });

  return [...people.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort(
      (left, right) =>
        right.sessions - left.sessions || left.name.localeCompare(right.name),
    );
}
