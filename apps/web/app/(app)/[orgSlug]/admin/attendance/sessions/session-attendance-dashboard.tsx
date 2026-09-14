'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type {
  AdminOrgProfileOptionVM,
  AdminSessionCompletionVM,
} from '@iconicedu/shared-types';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@iconicedu/ui-web';
import {
  AdminFilterBar,
  FilterDropdown,
} from '@iconicedu/web/components/admin/admin-filter-bar';
import { CompletedSessionsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/completed-sessions-table';
import {
  OverviewSkeleton,
  TableSkeleton,
  TrendSkeleton,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-skeletons';
import type { ScheduleOptionRow } from '@iconicedu/web/lib/api/schedules';
import {
  ALL_COMPLETION_MONTHS,
  buildConfirmerBreakdown,
  buildMonthFilterHref,
  buildWeeklySessionTrend,
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

type Filters = typeof DEFAULT_FILTERS;

const TREND_CHART_CONFIG = {
  sessions: { label: 'Total sessions', color: 'var(--chart-1)' },
  confirmed: { label: 'Total confirmed', color: 'var(--chart-2)' },
  conflicts: { label: 'Total conflicts', color: 'var(--chart-5)' },
} satisfies ChartConfig;

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

// Always plots the last three months as weekly, session-date buckets —
// independent of every filter on the page (month, classroom, participant,
// method, search) — `trendRowsPromise` is a dedicated fetch the server never
// scopes to the selected month.
function TrendSection({
  trendRowsPromise,
}: {
  trendRowsPromise: Promise<AdminSessionCompletionVM[]>;
}) {
  const trendRows = React.use(trendRowsPromise);
  const points = React.useMemo(() => buildWeeklySessionTrend(trendRows), [trendRows]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold">Monthly Session Overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Weekly session activity over the last 3 months — independent of the filters
          below
        </p>
      </div>
      <div
        className="p-6"
        role="img"
        aria-label="Weekly session activity for the last 3 months"
      >
        <ChartContainer config={TREND_CHART_CONFIG} className="aspect-auto h-72 w-full">
          <AreaChart data={points} margin={{ left: 12, right: 12 }}>
            <defs>
              <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillConfirmed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-confirmed)" stopOpacity={0.5} />
                <stop
                  offset="95%"
                  stopColor="var(--color-confirmed)"
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient id="fillConflicts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-conflicts)" stopOpacity={0.5} />
                <stop
                  offset="95%"
                  stopColor="var(--color-conflicts)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={28}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="sessions"
              type="monotone"
              fill="url(#fillSessions)"
              stroke="var(--color-sessions)"
              strokeWidth={2}
            />
            <Area
              dataKey="confirmed"
              type="monotone"
              fill="url(#fillConfirmed)"
              stroke="var(--color-confirmed)"
              strokeWidth={2}
            />
            <Area
              dataKey="conflicts"
              type="monotone"
              fill="url(#fillConflicts)"
              stroke="var(--color-conflicts)"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  role,
  hoursLabel,
}: {
  title: string;
  rows: AdminSessionCompletionVM[];
  role: 'educator' | 'guardian';
  hoursLabel: string;
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
              <p className="mt-1 text-xs text-muted-foreground">
                {person.hours.toFixed(1)}h {hoursLabel}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Metrics, the top filter bar, and both breakdown widgets all read from the same
// `rowsPromise` (scoped to the selected month) plus the org teacher/parent roster
// used to populate the "Filter by participant" dropdowns.
function OverviewSection({
  rowsPromise,
  rosterPromise,
  filters,
  update,
  selectedMonth,
  monthOptions,
  handleMonthChange,
  selectedPeriodLabel,
}: {
  rowsPromise: Promise<AdminSessionCompletionVM[]>;
  rosterPromise: Promise<[AdminOrgProfileOptionVM[], AdminOrgProfileOptionVM[]]>;
  filters: Filters;
  update: (key: keyof Filters) => (value: string) => void;
  selectedMonth: string;
  monthOptions: string[];
  handleMonthChange: (value: string) => void;
  selectedPeriodLabel: string;
}) {
  const rows = React.use(rowsPromise);
  const [teachers, parents] = React.use(rosterPromise);

  // Threading `selectedMonth` through keeps the period label and count honest —
  // it's a no-op for "all months" since the server already scoped `rows`.
  const filtered = React.useMemo(
    () => filterCompletions(rows, { ...filters, month: selectedMonth }),
    [filters, rows, selectedMonth],
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

  return (
    <>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Unlike the metrics/trend blocks, these read every session in the
            completions table for the month — including still-pending and disputed
            ones — so every teacher/parent with a session shows up, with their
            confirmed/total ratio and hours counting every session they're part of. */}
        <Breakdown
          title="Completed by teacher"
          rows={rows}
          role="educator"
          hoursLabel="completed"
        />
        <Breakdown
          title="Completed by parent"
          rows={rows}
          role="guardian"
          hoursLabel="taken"
        />
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
    </>
  );
}

// The session list only needs `rows` + `schedules` (for the "Add session"
// dialog) — kept in its own Suspense boundary so a slow schedules fetch never
// blocks the metrics/filters/breakdowns above from painting, and vice versa.
function TableSection({
  rowsPromise,
  schedulesPromise,
  filters,
  selectedMonth,
  orgId,
}: {
  rowsPromise: Promise<AdminSessionCompletionVM[]>;
  schedulesPromise: Promise<ScheduleOptionRow[]>;
  filters: Filters;
  selectedMonth: string;
  orgId: string;
}) {
  const rows = React.use(rowsPromise);
  const schedules = React.use(schedulesPromise);
  const filtered = React.useMemo(
    () => filterCompletions(rows, { ...filters, month: selectedMonth }),
    [filters, rows, selectedMonth],
  );

  return <CompletedSessionsTable rows={filtered} schedules={schedules} orgId={orgId} />;
}

export function SessionAttendanceDashboard({
  rowsPromise,
  trendRowsPromise,
  rosterPromise,
  schedulesPromise,
  selectedMonth,
  monthOptions,
  orgId,
}: {
  rowsPromise: Promise<AdminSessionCompletionVM[]>;
  trendRowsPromise: Promise<AdminSessionCompletionVM[]>;
  rosterPromise: Promise<[AdminOrgProfileOptionVM[], AdminOrgProfileOptionVM[]]>;
  schedulesPromise: Promise<ScheduleOptionRow[]>;
  selectedMonth: string;
  monthOptions: string[];
  orgId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMonthPending, startMonthTransition] = React.useTransition();
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const update = (key: keyof Filters) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  // Changing the month navigates so the server can load that month's rows; the
  // other filters stay in-memory over whatever month is currently loaded. Doing
  // this inside a transition keeps every section's last-rendered content visible
  // (dimmed via aria-busy) instead of reverting to its Suspense fallback.
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
      {isMonthPending && (
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-hidden="true"
        >
          <Loader2 className="size-3.5 animate-spin" />
          Loading {selectedPeriodLabel}…
        </div>
      )}

      <React.Suspense fallback={<TrendSkeleton />}>
        <TrendSection trendRowsPromise={trendRowsPromise} />
      </React.Suspense>

      <React.Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection
          rowsPromise={rowsPromise}
          rosterPromise={rosterPromise}
          filters={filters}
          update={update}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
          handleMonthChange={handleMonthChange}
          selectedPeriodLabel={selectedPeriodLabel}
        />
      </React.Suspense>

      <React.Suspense fallback={<TableSkeleton />}>
        <TableSection
          rowsPromise={rowsPromise}
          schedulesPromise={schedulesPromise}
          filters={filters}
          selectedMonth={selectedMonth}
          orgId={orgId}
        />
      </React.Suspense>
    </div>
  );
}
