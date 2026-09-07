'use client';

import * as React from 'react';
import { CalendarCheck2, GraduationCap, Star, UsersRound } from 'lucide-react';
import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@iconicedu/ui-web';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';
import { CompletedSessionsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/completed-sessions-table';
import {
  buildConfirmerBreakdown,
  buildMonthlyCompletionTrend,
  filterCompletions,
  formatCompletionMonth,
  getCompletionMonthKey,
  summarizeCompletions,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';

const DEFAULT_FILTERS = {
  search: '',
  month: 'all',
  teacherId: 'all',
  parentId: 'all',
  studentName: 'all',
  method: 'all',
};

function Metric({
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
    <div className="flex min-w-0 items-start justify-between gap-4 p-5 sm:p-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function Trend({ rows }: { rows: AdminSessionCompletionVM[] }) {
  const points = buildMonthlyCompletionTrend(rows);
  const maximum = Math.max(1, ...points.map((point) => point.sessions));
  return (
    <div className="border-t px-5 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-semibold">Monthly completed lessons</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Change over time for the last 12 active months
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {points.length} active {points.length === 1 ? 'month' : 'months'}
        </span>
      </div>
      {points.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          No completed sessions match these filters.
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          role="img"
          aria-label="Monthly completed sessions"
        >
          <div className="flex h-60 min-w-[520px] items-end gap-3 border-b px-2 pt-8">
            {points.map((point) => (
              <div
                key={point.key}
                className="group flex h-full min-w-12 flex-1 flex-col justify-end"
              >
                <div className="mb-2 text-center text-xs font-medium text-muted-foreground">
                  {point.sessions}
                </div>
                <div
                  className="mx-auto w-full max-w-14 rounded-t-md bg-primary/80 group-hover:bg-primary"
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
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
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
  const people = buildConfirmerBreakdown(rows, role).slice(0, 5);
  const maximum = Math.max(1, ...people.map((person) => person.sessions));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No confirmations recorded.
          </p>
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

export function SessionAttendanceDashboard({
  rows,
}: {
  rows: AdminSessionCompletionVM[];
}) {
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const update = (key: keyof typeof DEFAULT_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const filtered = React.useMemo(() => filterCompletions(rows, filters), [filters, rows]);
  const summary = summarizeCompletions(filtered);
  const months = [...new Set(rows.map((row) => getCompletionMonthKey(row.sessionEndAt)))]
    .filter(Boolean)
    .sort()
    .reverse();
  const people = (role: 'educator' | 'guardian') =>
    new Map(
      rows.flatMap((row) =>
        row.confirmedBy
          .filter((actor) => actor.role === role)
          .map((actor) => [actor.profileId, actor.displayName] as const),
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
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl">Completed lesson performance</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Monthly completion activity across teachers, parents, and students.
            </p>
          </div>
          <AdminFilterBar
            layout="toolbar"
            embedded
            filterTitle="Filter completed lessons"
            filterDescription="Narrow the overview and session records together."
            search={filters.search}
            onSearchChange={update('search')}
            searchPlaceholder="Search completed lessons"
            filterGroups={[
              {
                label: 'Month',
                value: filters.month,
                onChange: update('month'),
                options: [
                  { value: 'all', label: 'All months' },
                  ...months.map((value) => ({
                    value,
                    label: formatCompletionMonth(value),
                  })),
                ],
              },
              {
                label: 'Teacher',
                value: filters.teacherId,
                onChange: update('teacherId'),
                options: options(people('educator'), 'All teachers'),
              },
              {
                label: 'Parent',
                value: filters.parentId,
                onChange: update('parentId'),
                options: options(people('guardian'), 'All parents'),
              },
              {
                label: 'Student',
                value: filters.studentName,
                onChange: update('studentName'),
                options: [
                  { value: 'all', label: 'All students' },
                  ...students.map((name) => ({ value: name, label: name })),
                ],
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
                ],
              },
            ]}
          />
        </CardHeader>
        <div className="grid divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Metric
            label="Completed lessons"
            value={summary.completedSessions}
            detail="Unique schedule occurrences"
            icon={CalendarCheck2}
          />
          <Metric
            label="Teacher confirmed"
            value={summary.teacherConfirmed}
            detail="Completed by an educator"
            icon={GraduationCap}
          />
          <Metric
            label="Parent confirmed"
            value={summary.parentConfirmed}
            detail="Completed by a guardian"
            icon={UsersRound}
          />
          <Metric
            label="Average rating"
            value={summary.averageRating == null ? '—' : summary.averageRating.toFixed(1)}
            detail="Across rated sessions"
            icon={Star}
          />
        </div>
        <Trend rows={filtered} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Completed by teacher" rows={filtered} role="educator" />
        <Breakdown title="Completed by parent" rows={filtered} role="guardian" />
      </div>
      <section className="space-y-3" aria-labelledby="completed-records-heading">
        <div>
          <h2 id="completed-records-heading" className="text-lg font-semibold">
            Completed session records
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} matching {filtered.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>
        <CompletedSessionsTable rows={filtered} />
      </section>
    </div>
  );
}
