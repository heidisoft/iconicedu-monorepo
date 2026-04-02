'use client';

import { useMemo } from 'react';
import type {
  AdminRankedMetricVM,
  AdminReportsDashboardVM,
  AdminTimeSeriesPointVM,
} from '@iconicedu/shared-types';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@iconicedu/ui-web/ui/table';
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from '@iconicedu/ui-web/ui/chart';

import { AdminReportChartCard } from './admin-report-chart-card';
import { AdminReportKpiCard } from './admin-report-kpi-card';

const SERIES_COLORS: Record<string, string> = {
  guardian: '#2563eb',
  educator: '#059669',
  child: '#f59e0b',
  staff: '#9333ea',
  admin: '#dc2626',
  owner: '#0f766e',
  unknown: '#64748b',
  users: '#2563eb',
  families: '#059669',
  channels: '#f59e0b',
  learning_spaces: '#9333ea',
  completed_sessions: '#2563eb',
  scheduled_sessions: '#0f766e',
  attendance_rate: '#059669',
  messages: '#2563eb',
  created: '#2563eb',
  read: '#059669',
  read_rate: '#9333ea',
};

function formatSeriesLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function buildChartConfig(points: AdminTimeSeriesPointVM[]) {
  const uniqueSeries = Array.from(
    new Set(
      points
        .map((point) => point.series)
        .filter((series): series is string => Boolean(series)),
    ),
  );

  return Object.fromEntries(
    uniqueSeries.map((series) => [
      series,
      {
        label: formatSeriesLabel(series),
        color: SERIES_COLORS[series] ?? '#64748b',
      },
    ]),
  );
}

function toMultiSeriesData(points: AdminTimeSeriesPointVM[]) {
  const rows = new Map<string, Record<string, string | number>>();

  points.forEach((point) => {
    const bucketKey = point.bucketStart;
    const row = rows.get(bucketKey) ?? { label: point.label };
    row[point.series ?? 'value'] = point.value;
    rows.set(bucketKey, row);
  });

  return Array.from(rows.values());
}

function toSingleSeriesData(points: AdminTimeSeriesPointVM[]) {
  return points.map((point) => ({
    label: point.label,
    value: point.value,
  }));
}

function formatAttendancePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function RankedTable({ items }: { items: AdminRankedMetricVM[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">Meta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.label}</TableCell>
            <TableCell className="text-right">{item.value.toLocaleString()}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {item.secondaryLabel &&
              item.secondaryValue !== undefined &&
              item.secondaryValue !== null
                ? `${item.secondaryValue.toLocaleString()} ${item.secondaryLabel}`
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MonthlyUserGrowthChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  const config = useMemo(
    () => buildChartConfig(dashboard.monthlyUserGrowth),
    [dashboard.monthlyUserGrowth],
  );
  const data = useMemo(
    () => toMultiSeriesData(dashboard.monthlyUserGrowth),
    [dashboard.monthlyUserGrowth],
  );

  return (
    <AdminReportChartCard
      title="Monthly user growth"
      description="New accounts added per month, split by role."
      isEmpty={!data.length}
      className="xl:col-span-2"
    >
      <ChartContainer config={config}>
        <AreaChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
          {Object.entries(config).map(([key, entry]) => (
            <Area
              key={key}
              dataKey={key}
              name={entry.label}
              type="monotone"
              fill={entry.color}
              fillOpacity={0.18}
              stroke={entry.color}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function MonthlyUsageByRoleChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  const config = useMemo(
    () => buildChartConfig(dashboard.monthlyUsageByRole),
    [dashboard.monthlyUsageByRole],
  );
  const data = useMemo(
    () => toMultiSeriesData(dashboard.monthlyUsageByRole),
    [dashboard.monthlyUsageByRole],
  );

  return (
    <AdminReportChartCard
      title="Monthly usage by role"
      description="Combined message and session participation activity by role."
      isEmpty={!data.length}
      className="xl:col-span-2"
    >
      <ChartContainer config={config}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
          {Object.entries(config).map(([key, entry]) => (
            <Bar
              key={key}
              dataKey={key}
              name={entry.label}
              stackId="usage"
              fill={entry.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function MonthlyAttendanceChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  const data = useMemo(
    () => toSingleSeriesData(dashboard.monthlyAttendance),
    [dashboard.monthlyAttendance],
  );

  return (
    <AdminReportChartCard
      title="Attendance of sessions"
      description="Average attendance rate for completed sessions each month."
      isEmpty={!data.some((point) => point.value > 0)}
    >
      <ChartContainer
        config={{
          attendance_rate: {
            label: 'Attendance rate',
            color: SERIES_COLORS.attendance_rate,
          },
        }}
      >
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 1]}
            tickFormatter={formatAttendancePercent}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatAttendancePercent(value)}
              />
            }
          />
          <Bar
            dataKey="value"
            name="Attendance rate"
            fill={SERIES_COLORS.attendance_rate}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function MonthlyCompletedSessionsChart({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  const data = useMemo(
    () => toSingleSeriesData(dashboard.monthlyCompletedSessions),
    [dashboard.monthlyCompletedSessions],
  );

  return (
    <AdminReportChartCard
      title="Monthly completed sessions"
      description="Completed live sessions in each full month."
      isEmpty={!data.some((point) => point.value > 0)}
      className="xl:col-span-2"
    >
      <ChartContainer
        config={{
          completed_sessions: {
            label: 'Completed sessions',
            color: SERIES_COLORS.completed_sessions,
          },
        }}
      >
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Completed sessions"
            fill={SERIES_COLORS.completed_sessions}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function WeeklyCompletedSessionsChart({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  const data = useMemo(
    () => toSingleSeriesData(dashboard.weeklyCompletedSessions),
    [dashboard.weeklyCompletedSessions],
  );

  return (
    <AdminReportChartCard
      title="Weekly completed sessions"
      description="Recent week-over-week session completion trend."
      isEmpty={!data.some((point) => point.value > 0)}
      className="xl:col-span-2"
    >
      <ChartContainer
        config={{
          completed_sessions: {
            label: 'Completed sessions',
            color: SERIES_COLORS.completed_sessions,
          },
        }}
      >
        <LineChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="value"
            name="Completed sessions"
            type="monotone"
            stroke={SERIES_COLORS.completed_sessions}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function UpcomingScheduledSessionsChart({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  const data = useMemo(
    () => toSingleSeriesData(dashboard.upcomingScheduledSessionsByWeek),
    [dashboard.upcomingScheduledSessionsByWeek],
  );

  return (
    <AdminReportChartCard
      title="Upcoming sessions by week"
      description="Forward-looking view of scheduled classroom sessions across the next 8 weeks."
      isEmpty={!data.some((point) => point.value > 0)}
      className="xl:col-span-2"
    >
      <ChartContainer
        config={{
          scheduled_sessions: {
            label: 'Scheduled sessions',
            color: SERIES_COLORS.scheduled_sessions,
          },
        }}
      >
        <LineChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="value"
            name="Scheduled sessions"
            type="monotone"
            stroke={SERIES_COLORS.scheduled_sessions}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function GrowthSeriesChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  const config = useMemo(
    () => buildChartConfig(dashboard.growthSeries),
    [dashboard.growthSeries],
  );
  const data = useMemo(
    () => toMultiSeriesData(dashboard.growthSeries),
    [dashboard.growthSeries],
  );

  return (
    <AdminReportChartCard
      title="Growth charts"
      description="Cumulative growth for users, families, channels, and learning spaces."
      isEmpty={!data.length}
      className="xl:col-span-2"
    >
      <ChartContainer config={config}>
        <LineChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
          {Object.entries(config).map(([key, entry]) => (
            <Line
              key={key}
              dataKey={key}
              name={entry.label}
              type="monotone"
              stroke={entry.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function TeacherRankingChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  return (
    <AdminReportChartCard
      title="Completed sessions by teacher"
      description="Teachers ranked by the number of completed sessions."
      isEmpty={!dashboard.completedSessionsByTeacher.length}
      footer={<RankedTable items={dashboard.completedSessionsByTeacher} />}
    >
      <ChartContainer
        config={{
          completed_sessions: {
            label: 'Completed sessions',
            color: SERIES_COLORS.completed_sessions,
          },
        }}
      >
        <BarChart
          data={dashboard.completedSessionsByTeacher}
          layout="vertical"
          margin={{ left: 20 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Completed sessions"
            fill={SERIES_COLORS.completed_sessions}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function FamilyRankingChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  return (
    <AdminReportChartCard
      title="Completed sessions by family"
      description="Families ranked by the number of completed learner sessions."
      isEmpty={!dashboard.completedSessionsByFamily.length}
      footer={<RankedTable items={dashboard.completedSessionsByFamily} />}
    >
      <ChartContainer
        config={{
          completed_sessions: {
            label: 'Completed sessions',
            color: SERIES_COLORS.attendance_rate,
          },
        }}
      >
        <BarChart
          data={dashboard.completedSessionsByFamily}
          layout="vertical"
          margin={{ left: 20 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Completed sessions"
            fill={SERIES_COLORS.attendance_rate}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function ChannelUsageChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  return (
    <AdminReportChartCard
      title="Channel usage"
      description="Most active channels by message volume, with participant context."
      isEmpty={!dashboard.channelUsage.length}
      footer={<RankedTable items={dashboard.channelUsage} />}
      className="xl:col-span-2"
    >
      <ChartContainer
        config={{
          messages: {
            label: 'Messages',
            color: SERIES_COLORS.messages,
          },
        }}
      >
        <BarChart data={dashboard.channelUsage}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} hide />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Messages"
            fill={SERIES_COLORS.messages}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function ChannelTypeMixChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  const palette = ['#2563eb', '#059669', '#f59e0b', '#9333ea', '#dc2626'];

  return (
    <AdminReportChartCard
      title="Channel type mix"
      description="Message activity split by channel kind across the reporting window."
      isEmpty={!dashboard.channelTypeMix.length}
      footer={<RankedTable items={dashboard.channelTypeMix} />}
    >
      <ChartContainer
        config={Object.fromEntries(
          dashboard.channelTypeMix.map((item, index) => [
            item.id,
            {
              label: item.label,
              color: palette[index % palette.length],
            },
          ]),
        )}
      >
        <PieChart>
          <Tooltip content={<ChartTooltipContent />} />
          <Pie
            data={dashboard.channelTypeMix}
            dataKey="value"
            nameKey="label"
            innerRadius={56}
            outerRadius={92}
            paddingAngle={2}
          >
            {dashboard.channelTypeMix.map((item, index) => (
              <Cell key={item.id} fill={palette[index % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function InboxActivityByMonthChart({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  const config = useMemo(
    () => buildChartConfig(dashboard.inboxActivityByMonth),
    [dashboard.inboxActivityByMonth],
  );
  const data = useMemo(
    () => toMultiSeriesData(dashboard.inboxActivityByMonth),
    [dashboard.inboxActivityByMonth],
  );

  return (
    <AdminReportChartCard
      title="Inbox activity by month"
      description="Inbox items created and marked read across the reporting window."
      isEmpty={!data.length}
      className="xl:col-span-2"
    >
      <ChartContainer config={config}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
          {Object.entries(config).map(([key, entry]) => (
            <Bar
              key={key}
              dataKey={key}
              name={entry.label}
              stackId={key === 'created' || key === 'read' ? undefined : 'inbox'}
              fill={entry.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function InboxReadRateChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  const data = useMemo(
    () => toSingleSeriesData(dashboard.inboxReadRateByMonth),
    [dashboard.inboxReadRateByMonth],
  );

  return (
    <AdminReportChartCard
      title="Inbox read rate"
      description="Share of inbox items read by recipients each month."
      isEmpty={!data.some((point) => point.value > 0)}
    >
      <ChartContainer
        config={{
          read_rate: {
            label: 'Read rate',
            color: SERIES_COLORS.read_rate,
          },
        }}
      >
        <LineChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 1]}
            tickFormatter={formatAttendancePercent}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatAttendancePercent(value)}
              />
            }
          />
          <Line
            dataKey="value"
            name="Read rate"
            type="monotone"
            stroke={SERIES_COLORS.read_rate}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function NotificationDispatchByChannelChart({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  return (
    <AdminReportChartCard
      title="Notification dispatch by channel"
      description="Delivery jobs created for each notification channel, with successful sends as context."
      isEmpty={!dashboard.notificationDispatchByChannel.length}
      footer={<RankedTable items={dashboard.notificationDispatchByChannel} />}
    >
      <ChartContainer
        config={{
          dispatches: {
            label: 'Dispatches',
            color: SERIES_COLORS.messages,
          },
        }}
      >
        <BarChart data={dashboard.notificationDispatchByChannel}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Dispatches"
            fill={SERIES_COLORS.messages}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

function InboxActivityByVerbChart({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  return (
    <AdminReportChartCard
      title="Top inbox activity types"
      description="Inbox activity grouped by verb, with unread counts shown as context."
      isEmpty={!dashboard.inboxActivityByVerb.length}
      footer={<RankedTable items={dashboard.inboxActivityByVerb} />}
    >
      <ChartContainer
        config={{
          inbox_items: {
            label: 'Inbox items',
            color: SERIES_COLORS.scheduled_sessions,
          },
        }}
      >
        <BarChart
          data={dashboard.inboxActivityByVerb}
          layout="vertical"
          margin={{ left: 20 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            name="Inbox items"
            fill={SERIES_COLORS.scheduled_sessions}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ChartContainer>
    </AdminReportChartCard>
  );
}

export function AdminReportsSummary({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  if (!dashboard.summary.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {dashboard.summary.map((metric) => (
        <AdminReportKpiCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

export function AdminClassroomSummary({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  if (!dashboard.classroomSummary.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {dashboard.classroomSummary.map((metric) => (
        <AdminReportKpiCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

export function AdminUserSummary({ dashboard }: { dashboard: AdminReportsDashboardVM }) {
  if (!dashboard.userSummary.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {dashboard.userSummary.map((metric) => (
        <AdminReportKpiCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

export function AdminChannelSummary({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  if (!dashboard.channelSummary.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {dashboard.channelSummary.map((metric) => (
        <AdminReportKpiCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

export function AdminActivitySummary({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  if (!dashboard.activitySummary.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {dashboard.activitySummary.map((metric) => (
        <AdminReportKpiCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

export function AdminUserReportsSection({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AdminUserSummary dashboard={dashboard} />
      <div className="grid gap-4 xl:grid-cols-2">
        <MonthlyUserGrowthChart dashboard={dashboard} />
        <MonthlyUsageByRoleChart dashboard={dashboard} />
      </div>
      <GrowthSeriesChart dashboard={dashboard} />
    </div>
  );
}

export function AdminClassroomReportsSection({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AdminClassroomSummary dashboard={dashboard} />
      <div className="grid gap-4 xl:grid-cols-2 [&>*:last-child:nth-child(odd)]:xl:col-span-2">
        <UpcomingScheduledSessionsChart dashboard={dashboard} />
        <MonthlyAttendanceChart dashboard={dashboard} />
        <MonthlyCompletedSessionsChart dashboard={dashboard} />
        <WeeklyCompletedSessionsChart dashboard={dashboard} />
        <TeacherRankingChart dashboard={dashboard} />
        <FamilyRankingChart dashboard={dashboard} />
      </div>
    </div>
  );
}

export function AdminChannelReportsSection({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AdminChannelSummary dashboard={dashboard} />
      <div className="grid gap-4 xl:grid-cols-2 [&>*:last-child:nth-child(odd)]:xl:col-span-2">
        <ChannelUsageChart dashboard={dashboard} />
        <ChannelTypeMixChart dashboard={dashboard} />
      </div>
    </div>
  );
}

export function AdminActivityReportsSection({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AdminActivitySummary dashboard={dashboard} />
      <div className="grid gap-4 xl:grid-cols-2 [&>*:last-child:nth-child(odd)]:xl:col-span-2">
        <InboxActivityByMonthChart dashboard={dashboard} />
        <InboxReadRateChart dashboard={dashboard} />
        <NotificationDispatchByChannelChart dashboard={dashboard} />
        <InboxActivityByVerbChart dashboard={dashboard} />
      </div>
    </div>
  );
}

export function AdminReportsOverview({
  dashboard,
}: {
  dashboard: AdminReportsDashboardVM;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AdminReportsSummary dashboard={dashboard} />
      <MonthlyAttendanceChart dashboard={dashboard} />
      <MonthlyCompletedSessionsChart dashboard={dashboard} />
      <div className="grid gap-4 xl:grid-cols-2 [&>*:last-child:nth-child(odd)]:xl:col-span-2">
        <MonthlyUserGrowthChart dashboard={dashboard} />
        <ChannelUsageChart dashboard={dashboard} />
      </div>
    </div>
  );
}
