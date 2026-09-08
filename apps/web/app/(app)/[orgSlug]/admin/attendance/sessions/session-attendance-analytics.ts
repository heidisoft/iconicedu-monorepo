import type {
  AdminSessionCompletionParticipantVM,
  AdminSessionCompletionVM,
} from '@iconicedu/shared-types';

export type CompletionFilters = {
  search: string;
  month: string;
  classroomId: string;
  teacherId: string;
  parentId: string;
  studentName: string;
  method: string;
};

// Sentinel for the full rolling three-month window enforced by the API.
export const ALL_COMPLETION_MONTHS = 'all';

const COMPLETION_MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function getCompletionMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isCompletionMonthKey(value: string) {
  return COMPLETION_MONTH_KEY_PATTERN.test(value);
}

/** UTC `YYYY-MM` for the month that `reference` falls in. */
export function getCurrentCompletionMonthKey(reference: Date = new Date()) {
  return `${reference.getUTCFullYear()}-${String(reference.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The `count` most recent month keys (current first), used to populate the month
 * filter without first loading every completion to discover which months have
 * data.
 */
export function buildRecentCompletionMonthKeys(count = 4, reference: Date = new Date()) {
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - offset, 1),
    );
    keys.push(getCurrentCompletionMonthKey(date));
  }
  return keys;
}

/**
 * `[since, until)` ISO bounds on `session_end_at` for a month key, or null for
 * `ALL_COMPLETION_MONTHS` / an unparseable key (API uses its three-month window).
 */
export function completionMonthKeyToUtcRange(key: string) {
  if (!isCompletionMonthKey(key)) return null;
  const [year, month] = key.split('-').map(Number);
  return {
    since: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    until: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
}

/** Keep the default three-month window implicit in shared URLs. */
export function buildMonthFilterHref(
  pathname: string,
  currentSearch: string,
  monthValue: string,
) {
  const params = new URLSearchParams(currentSearch);
  if (monthValue === ALL_COMPLETION_MONTHS) {
    params.delete('month');
  } else {
    params.set('month', monthValue);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function formatCompletionMonth(key: string) {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function filterCompletions(
  rows: AdminSessionCompletionVM[],
  filters: CompletionFilters,
) {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (
      filters.month !== 'all' &&
      getCompletionMonthKey(row.sessionEndAt) !== filters.month
    )
      return false;
    if (filters.classroomId !== 'all' && row.learningSpaceId !== filters.classroomId)
      return false;
    if (
      filters.teacherId !== 'all' &&
      !getCompletionParticipants(row).some(
        (actor) => actor.role === 'educator' && actor.profileId === filters.teacherId,
      )
    )
      return false;
    // The parent filter is scoped by the child in the room, not by who tapped
    // confirm: picking a parent shows every completed session for their kid, and
    // `confirmedBy` still reports who actually confirmed it.
    if (
      filters.parentId !== 'all' &&
      !(row.guardians ?? []).some((guardian) => guardian.profileId === filters.parentId)
    )
      return false;
    if (filters.studentName !== 'all' && !row.studentNames.includes(filters.studentName))
      return false;
    if (filters.method !== 'all' && row.completionMethod !== filters.method) return false;
    if (!search) return true;
    return [
      row.sessionTitle,
      row.learningSpaceTitle,
      ...row.studentNames,
      ...(row.guardians ?? []).map((guardian) => guardian.displayName),
      ...getCompletionParticipants(row).map((actor) => actor.displayName),
    ].some((value) => value?.toLocaleLowerCase().includes(search));
  });
}

export function summarizeCompletions(rows: AdminSessionCompletionVM[]) {
  const rated = rows.filter((row) => typeof row.averageRating === 'number');
  return {
    completedSessions: rows.length,
    teacherConfirmed: rows.filter((row) =>
      row.confirmedBy.some(
        (actor) => actor.role === 'educator' && actor.status === 'confirmed',
      ),
    ).length,
    parentConfirmed: rows.filter((row) =>
      row.confirmedBy.some(
        (actor) => actor.role === 'guardian' && actor.status === 'confirmed',
      ),
    ).length,
    averageRating: rated.length
      ? rated.reduce((sum, row) => sum + (row.averageRating ?? 0), 0) / rated.length
      : null,
  };
}

export function buildMonthlyCompletionTrend(rows: AdminSessionCompletionVM[]) {
  const buckets = new Map<
    string,
    { sessions: number; teacher: number; parent: number }
  >();
  rows.forEach((row) => {
    const key = getCompletionMonthKey(row.sessionEndAt);
    if (!key) return;
    const bucket = buckets.get(key) ?? { sessions: 0, teacher: 0, parent: 0 };
    bucket.sessions += 1;
    if (
      row.confirmedBy.some(
        (actor) => actor.role === 'educator' && actor.status === 'confirmed',
      )
    )
      bucket.teacher += 1;
    if (
      row.confirmedBy.some(
        (actor) => actor.role === 'guardian' && actor.status === 'confirmed',
      )
    )
      bucket.parent += 1;
    buckets.set(key, bucket);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, values]) => ({ key, label: formatCompletionMonth(key), ...values }));
}

/** Compatibility fallback for a web deployment preceding the API update. */
export function getCompletionParticipants(
  row: AdminSessionCompletionVM,
): AdminSessionCompletionParticipantVM[] {
  if (row.participants) return row.participants;
  const people = new Map<string, AdminSessionCompletionParticipantVM>();
  (row.guardians ?? []).forEach((person) => {
    people.set(`guardian|${person.profileId}`, {
      ...person,
      role: 'guardian',
      status: 'pending',
      rating: null,
    });
  });
  row.confirmedBy.forEach((actor) => {
    if (actor.role !== 'educator' && actor.role !== 'guardian') return;
    people.set(`${actor.role}|${actor.profileId}`, {
      ...actor,
      role: actor.role,
      rating: null,
    });
  });
  return [...people.values()];
}

export function buildConfirmerBreakdown(
  rows: AdminSessionCompletionVM[],
  role: 'educator' | 'guardian',
) {
  const people = new Map<string, { name: string; sessions: number; total: number }>();
  rows.forEach((row) => {
    new Map(
      getCompletionParticipants(row)
        .filter((actor) => actor.role === role)
        .map((actor) => [actor.profileId, actor]),
    ).forEach((actor) => {
      const value = people.get(actor.profileId) ?? {
        name: actor.displayName,
        sessions: 0,
        total: 0,
      };
      value.total += 1;
      if (actor.status === 'confirmed') value.sessions += 1;
      people.set(actor.profileId, value);
    });
  });
  return [...people.entries()]
    .map(([id, value]) => ({
      id,
      ...value,
      percentage: Math.round((value.sessions / value.total) * 100),
    }))
    .sort(
      (a, b) =>
        b.percentage - a.percentage ||
        b.sessions - a.sessions ||
        a.name.localeCompare(b.name),
    );
}
