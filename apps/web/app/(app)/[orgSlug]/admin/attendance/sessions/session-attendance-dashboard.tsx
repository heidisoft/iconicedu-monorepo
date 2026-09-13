'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  AdminOrgProfileOptionVM,
  AdminSessionCompletionVM,
} from '@iconicedu/shared-types';
import { Badge } from '@iconicedu/ui-web';
import {
  AdminFilterBar,
  FilterDropdown,
} from '@iconicedu/web/components/admin/admin-filter-bar';
import { CompletedSessionsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/completed-sessions-table';
import type { ScheduleOptionRow } from '@iconicedu/web/lib/api/schedules';
import {
  ALL_COMPLETION_MONTHS,
  buildConfirmerBreakdown,
  buildMonthFilterHref,
  buildMonthlyCompletionTrend,
  filterCompletions,
  formatCompletionMonth,
  summarizeCompletions,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';

const DEFAULT_FILTERS = {
  search: '',
  classroomId: 'all',
  teacherId: 'all',
  parentId: 'all',
  studentName: 'all',
  method: 'all',
};

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 pt-4 pb-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-4xl font-bold leading-none tracking-tight">{value}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Trend({ rows }: { rows: AdminSessionCompletionVM[] }) {
  const points = buildMonthlyCompletionTrend(rows);
  const maximum = Math.max(1, ...points.map((point) => point.sessions));
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold">Monthly completed lessons</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed sessions within the past three months
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {points.length} active {points.length === 1 ? 'month' : 'months'}
        </span>
      </div>
      {points.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          No completed sessions match these filters.
        </div>
      ) : (
        <div
          className="overflow-x-auto px-6 py-5"
          role="img"
          aria-label="Monthly completed sessions"
        >
          <div className="flex h-56 min-w-[520px] items-end gap-3 border-b px-2 pt-6">
            {points.map((point) => (
              <div
                key={point.key}
                className="group flex h-full min-w-12 flex-1 flex-col justify-end"
              >
                <div className="mb-2 text-center text-xs font-medium text-muted-foreground">
                  {point.sessions}
                </div>
                <div
                  className="mx-auto w-full max-w-14 rounded-t-sm bg-primary/75 transition-colors group-hover:bg-primary"
                  style={{
                    height: `${Math.max(8, (point.sessions / maximum) * 145)}px`,
                  }}
                  title={`${point.label}: ${point.sessions} completed sessions`}
                />
                <div className="mt-2 truncate text-center text-[11px] text-muted-foreground">
                  {point.label.replace(/ \d{4}$/, '')}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {points.reduce((sum, point) => sum + point.teacher, 0)} teacher-confirmed
            </span>
            <span>
              {points.reduce((sum, point) => sum + point.parent, 0)} parent-confirmed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  role,
}: {
  title: string;
  rows: AdminSessionCompletionVM[];
  role: 'educator' | 'guardian';
}) {
  const people = buildConfirmerBreakdown(rows, role);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-4 px-6 py-5">
        {people.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No matching tutors or parents.
          </p>
        ) : (
          people.map((person) => (
            <div key={person.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{person.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {person.sessions} / {person.total} confirmed · {person.percentage}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${person.percentage}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentCompletions({ rows }: { rows: AdminSessionCompletionVM[] }) {
  const recent = [...rows]
    .sort(
      (a, b) => new Date(b.sessionEndAt).getTime() - new Date(a.sessionEndAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold">Recent completed lessons</h2>
      </div>
      <div className="space-y-3 p-4">
        {recent.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No completed sessions match these filters.
          </p>
        ) : (
          recent.map((row) => (
            <div key={row.id} className="rounded-lg border bg-muted/25 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {row.sessionTitle ?? 'Scheduled session'}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {row.studentNames.join(', ') || 'No student listed'}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {row.completionMethod.replace('_', ' ')}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(row.sessionEndAt).toLocaleString('en-US', { timeZone: 'UTC' })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SessionAttendanceDashboard({
  rows,
  selectedMonth,
  monthOptions,
  teachers,
  parents,
  schedules,
  orgId,
}: {
  rows: AdminSessionCompletionVM[];
  selectedMonth: string;
  monthOptions: string[];
  teachers: AdminOrgProfileOptionVM[];
  parents: AdminOrgProfileOptionVM[];
  schedules: ScheduleOptionRow[];
  orgId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMonthPending, startMonthTransition] = React.useTransition();
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const update = (key: keyof typeof DEFAULT_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  // Changing the month navigates so the server can load that month's rows; the
  // other filters stay in-memory over whatever month is currently loaded.
  const handleMonthChange = React.useCallback(
    (value: string) => {
      if (value === selectedMonth) return;
      const href = buildMonthFilterHref(pathname, searchParams.toString(), value);
      startMonthTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [pathname, router, searchParams, selectedMonth],
  );

  // The server already scoped `rows` to `selectedMonth`; threading it through
  // keeps the period label and trend honest, and is a no-op for "all months".
  const filtered = React.useMemo(
    () => filterCompletions(rows, { ...filters, month: selectedMonth }),
    [filters, rows, selectedMonth],
  );
  // The trend/recent blocks report on *completed* lessons only and stay scoped
  // to the month filter — the participant/classroom/method/search filters below
  // only narrow the sessions table, not these summary blocks.
  const completedRows = React.useMemo(
    () =>
      rows.filter(
        (row) =>
          row.completionMethod !== 'pending' && row.completionMethod !== 'disputed',
      ),
    [rows],
  );
  // The top metric tiles count every session in the month, not just completed
  // ones, so pending/disputed sessions are reflected here too.
  const summary = summarizeCompletions(rows);
  const classrooms = new Map(
    rows.flatMap((row) =>
      row.learningSpaceId
        ? [[row.learningSpaceId, row.learningSpaceTitle ?? 'Untitled classroom'] as const]
        : [],
    ),
  );
  const students = [...new Set(rows.flatMap((row) => row.studentNames))].sort((a, b) =>
    a.localeCompare(b),
  );
  const options = (values: Map<string, string>, label: string) => [
    { value: 'all', label },
    ...[...values]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, name]) => ({ value, label: name })),
  ];
  const profileOptions = (values: AdminOrgProfileOptionVM[], label: string) => [
    { value: 'all', label },
    ...[...values]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((profile) => ({ value: profile.profileId, label: profile.displayName })),
  ];
  const selectedPeriodLabel =
    selectedMonth === ALL_COMPLETION_MONTHS
      ? 'Past 3 months'
      : formatCompletionMonth(selectedMonth);

  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-4 transition-opacity aria-busy:opacity-60"
      aria-busy={isMonthPending}
    >
      <span aria-live="polite" className="sr-only">
        {isMonthPending ? `Loading ${selectedPeriodLabel}` : ''}
      </span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Sessions"
          value={summary.completedSessions}
          detail="Unique schedule occurrences this month"
        />
        <Metric
          label="Teacher confirmed"
          value={`${summary.completedSessions ? Math.round((summary.teacherConfirmed / summary.completedSessions) * 100) : 0}%`}
          detail={`${summary.teacherConfirmed} / ${summary.completedSessions} sessions manually confirmed`}
        />
        <Metric
          label="Parent confirmed"
          value={`${summary.completedSessions ? Math.round((summary.parentConfirmed / summary.completedSessions) * 100) : 0}%`}
          detail={`${summary.parentConfirmed} / ${summary.completedSessions} sessions manually confirmed`}
        />
        <Metric
          label="Average rating"
          value={summary.averageRating == null ? '—' : summary.averageRating.toFixed(1)}
          detail="Across rated sessions"
        />
      </div>

      <div className="space-y-2">
        <AdminFilterBar
          layout="toolbar"
          filterTitle="Filter completed lessons"
          filterDescription="Narrow the overview and session records together."
          search={filters.search}
          onSearchChange={update('search')}
          searchPlaceholder="Search completed lessons"
          filterGroups={[
            {
              label: 'Month',
              value: selectedMonth,
              onChange: handleMonthChange,
              options: [
                { value: ALL_COMPLETION_MONTHS, label: 'Past 3 months' },
                ...monthOptions.map((value) => ({
                  value,
                  label: formatCompletionMonth(value),
                })),
              ],
            },
            {
              label: 'Classroom',
              value: filters.classroomId,
              onChange: update('classroomId'),
              options: options(classrooms, 'All classrooms'),
            },
            {
              label: 'Method',
              value: filters.method,
              onChange: update('method'),
              options: [
                { value: 'all', label: 'All methods' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'auto_confirmed', label: 'Auto-confirmed' },
                { value: 'mixed', label: 'Mixed' },
                { value: 'pending', label: 'Pending' },
                { value: 'disputed', label: 'Disputed' },
              ],
            },
          ]}
        />
        <p className="px-1 text-right text-xs text-muted-foreground">
          {selectedPeriodLabel} · {filtered.length} matching{' '}
          {filtered.length === 1 ? 'session' : 'sessions'}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Trend rows={completedRows} />
        <RecentCompletions rows={completedRows} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Unlike the metrics/trend/recent blocks, these read every session in the
            completions table for the month — including still-pending and disputed
            ones — so every teacher/parent with a session shows up, with their
            confirmed/total ratio counting every session they're part of. */}
        <Breakdown title="Completed by teacher" rows={rows} role="educator" />
        <Breakdown title="Completed by parent" rows={rows} role="guardian" />
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filter by participant
        </span>
        <FilterDropdown
          group={{
            label: 'Teacher',
            value: filters.teacherId,
            onChange: update('teacherId'),
            options: profileOptions(teachers, 'All teachers'),
          }}
        />
        <FilterDropdown
          group={{
            label: 'Parent',
            value: filters.parentId,
            onChange: update('parentId'),
            options: profileOptions(parents, 'All parents'),
          }}
        />
        <FilterDropdown
          group={{
            label: 'Student',
            value: filters.studentName,
            onChange: update('studentName'),
            options: [
              { value: 'all', label: 'All students' },
              ...students.map((name) => ({ value: name, label: name })),
            ],
          }}
        />
      </div>

      <CompletedSessionsTable rows={filtered} schedules={schedules} orgId={orgId} />
    </div>
  );
}
