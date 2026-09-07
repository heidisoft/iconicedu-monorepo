import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';

export type CompletionFilters = {
  search: string;
  month: string;
  teacherId: string;
  parentId: string;
  studentName: string;
  method: string;
};

export function getCompletionMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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
    if (
      filters.teacherId !== 'all' &&
      !row.confirmedBy.some(
        (actor) => actor.role === 'educator' && actor.profileId === filters.teacherId,
      )
    )
      return false;
    if (
      filters.parentId !== 'all' &&
      !row.confirmedBy.some(
        (actor) => actor.role === 'guardian' && actor.profileId === filters.parentId,
      )
    )
      return false;
    if (filters.studentName !== 'all' && !row.studentNames.includes(filters.studentName))
      return false;
    if (filters.method !== 'all' && row.completionMethod !== filters.method) return false;
    if (!search) return true;
    return [
      row.sessionTitle,
      ...row.studentNames,
      ...row.confirmedBy.map((actor) => actor.displayName),
    ].some((value) => value?.toLocaleLowerCase().includes(search));
  });
}

export function summarizeCompletions(rows: AdminSessionCompletionVM[]) {
  const rated = rows.filter((row) => typeof row.averageRating === 'number');
  return {
    completedSessions: rows.length,
    teacherConfirmed: rows.filter((row) =>
      row.confirmedBy.some((actor) => actor.role === 'educator'),
    ).length,
    parentConfirmed: rows.filter((row) =>
      row.confirmedBy.some((actor) => actor.role === 'guardian'),
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
    if (row.confirmedBy.some((actor) => actor.role === 'educator')) bucket.teacher += 1;
    if (row.confirmedBy.some((actor) => actor.role === 'guardian')) bucket.parent += 1;
    buckets.set(key, bucket);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, values]) => ({ key, label: formatCompletionMonth(key), ...values }));
}

export function buildConfirmerBreakdown(
  rows: AdminSessionCompletionVM[],
  role: 'educator' | 'guardian',
) {
  const people = new Map<string, { name: string; sessions: number }>();
  rows.forEach((row) => {
    new Map(
      row.confirmedBy
        .filter((actor) => actor.role === role)
        .map((actor) => [actor.profileId, actor]),
    ).forEach((actor) => {
      const value = people.get(actor.profileId) ?? {
        name: actor.displayName,
        sessions: 0,
      };
      value.sessions += 1;
      people.set(actor.profileId, value);
    });
  });
  return [...people.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}
