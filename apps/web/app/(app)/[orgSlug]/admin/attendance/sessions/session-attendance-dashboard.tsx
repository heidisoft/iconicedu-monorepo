'use client';

import * as React from 'react';
import { CalendarCheck2, ChartNoAxesCombined, CircleX, UsersRound } from 'lucide-react';

import type { LiveSessionAttendanceListItemVM } from '@iconicedu/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@iconicedu/ui-web';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';
import { LiveSessionAttendanceTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance-table';
import {
  buildMonthlyAttendanceTrend,
  buildPersonBreakdown,
  filterAttendanceRows,
  formatAttendanceMonth,
  getAttendanceMonthKey,
  summarizeAttendance,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';

type Props = {
  orgSlug: string;
  rows: LiveSessionAttendanceListItemVM[];
};

const ALL_FILTERS = {
  search: '',
  month: 'all',
  teacherId: 'all',
  parentId: 'all',
  status: 'ended',
  scope: 'all',
};

function percentage(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyTrend({ rows }: { rows: LiveSessionAttendanceListItemVM[] }) {
  const points = buildMonthlyAttendanceTrend(rows);
  const maxSessions = Math.max(1, ...points.map((point) => point.sessions));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Monthly change over time</CardTitle>
        <p className="text-sm text-muted-foreground">
          Completed sessions and attendance rate for the last 12 active months.
        </p>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            No completed sessions match these filters.
          </div>
        ) : (
          <div
            className="overflow-x-auto"
            role="img"
            aria-label="Monthly completed sessions and attendance rate"
          >
            <div className="flex h-60 min-w-[520px] items-end gap-3 border-b px-2 pt-8">
              {points.map((point) => (
                <div
                  key={point.key}
                  className="group flex h-full min-w-12 flex-1 flex-col justify-end"
                >
                  <div className="mb-2 text-center text-xs font-medium text-muted-foreground">
                    {percentage(point.attendanceRate)}
                  </div>
                  <div
                    className="mx-auto w-full max-w-14 rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{
                      height: `${Math.max(8, (point.sessions / maxSessions) * 145)}px`,
                    }}
                    title={`${point.label}: ${point.sessions} completed sessions, ${percentage(point.attendanceRate)} attendance`}
                  />
                  <div className="mt-2 truncate text-center text-[11px] text-muted-foreground">
                    {point.label.replace(/ \d{4}$/, '')}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Bar height: completed sessions</span>
              <span>Label: attendance rate</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonBreakdown({
  title,
  emptyLabel,
  rows,
  kind,
}: {
  title: string;
  emptyLabel: string;
  rows: LiveSessionAttendanceListItemVM[];
  kind: 'teacher' | 'parent';
}) {
  const people = buildPersonBreakdown(rows, kind).slice(0, 5);
  const maximum = Math.max(1, ...people.map((person) => person.sessions));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          people.map((person) => (
            <div key={person.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{person.name}</span>
                <span className="shrink-0 text-muted-foreground">{person.sessions}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(person.sessions / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SessionAttendanceDashboard({ orgSlug, rows }: Props) {
  const [filters, setFilters] = React.useState(ALL_FILTERS);
  const update = (key: keyof typeof ALL_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const filteredRows = React.useMemo(
    () => filterAttendanceRows(rows, filters),
    [filters, rows],
  );
  const summary = summarizeAttendance(filteredRows);

  const months = [...new Set(rows.map((row) => getAttendanceMonthKey(row.startedAt)))]
    .filter(Boolean)
    .sort()
    .reverse();
  const teachers = new Map(
    rows.flatMap((row) =>
      row.startedBy
        ? [[row.startedBy.ids.id, row.startedBy.profile.displayName] as const]
        : [],
    ),
  );
  const parents = new Map(
    rows.flatMap((row) =>
      (row.participants ?? [])
        .filter((profile) => profile.kind === 'guardian')
        .map((profile) => [profile.ids.id, profile.profile.displayName] as const),
    ),
  );

  return (
    <div className="space-y-6">
      <AdminFilterBar
        search={filters.search}
        onSearchChange={update('search')}
        searchPlaceholder="Class, teacher, or parent"
        filterGroups={[
          {
            label: 'Month',
            value: filters.month,
            onChange: update('month'),
            options: [
              { value: 'all', label: 'All months' },
              ...months.map((month) => ({
                value: month,
                label: formatAttendanceMonth(month),
              })),
            ],
          },
          {
            label: 'Teacher',
            value: filters.teacherId,
            onChange: update('teacherId'),
            options: [
              { value: 'all', label: 'All teachers' },
              ...[...teachers]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([value, label]) => ({ value, label })),
            ],
          },
          {
            label: 'Parent',
            value: filters.parentId,
            onChange: update('parentId'),
            options: [
              { value: 'all', label: 'All parents' },
              ...[...parents]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([value, label]) => ({ value, label })),
            ],
          },
          {
            label: 'Status',
            value: filters.status,
            onChange: update('status'),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'ended', label: 'Completed' },
              { value: 'live', label: 'Live' },
              { value: 'failed', label: 'Failed' },
              { value: 'starting', label: 'Starting' },
            ],
          },
          {
            label: 'Type',
            value: filters.scope,
            onChange: update('scope'),
            options: [
              { value: 'all', label: 'All types' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'ad-hoc', label: 'Ad hoc' },
            ],
          },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Completed sessions"
          value={summary.completedSessions}
          detail="Sessions ended in this view"
          icon={CalendarCheck2}
        />
        <MetricCard
          label="Attendance rate"
          value={percentage(summary.attendanceRate)}
          detail="Attendees out of expected"
          icon={UsersRound}
        />
        <MetricCard
          label="Full attendance"
          value={percentage(summary.fullAttendanceRate)}
          detail="Met the attendance policy"
          icon={ChartNoAxesCombined}
        />
        <MetricCard
          label="No-shows"
          value={summary.noShows}
          detail="Expected participants absent"
          icon={CircleX}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <MonthlyTrend rows={filteredRows} />
        <PersonBreakdown
          title="Completed by teacher"
          emptyLabel="No teacher data available."
          rows={filteredRows}
          kind="teacher"
        />
        <PersonBreakdown
          title="Completed by parent"
          emptyLabel="No parent attendance recorded."
          rows={filteredRows}
          kind="parent"
        />
      </div>

      <section aria-labelledby="session-records-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="session-records-heading" className="text-lg font-semibold">
              Session records
            </h2>
            <p className="text-sm text-muted-foreground">
              {filteredRows.length} matching{' '}
              {filteredRows.length === 1 ? 'session' : 'sessions'}
            </p>
          </div>
        </div>
        <LiveSessionAttendanceTable orgSlug={orgSlug} rows={filteredRows} />
      </section>
    </div>
  );
}
