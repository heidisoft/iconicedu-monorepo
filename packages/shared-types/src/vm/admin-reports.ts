'use strict';

export interface AdminReportKpiVM {
  key: string;
  label: string;
  value: number;
  description?: string | null;
}

export interface AdminTimeSeriesPointVM {
  bucketStart: string;
  label: string;
  value: number;
  series?: string | null;
}

export interface AdminRankedMetricVM {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number | null;
  secondaryLabel?: string | null;
}

export interface AdminReportsDashboardVM {
  generatedAt: string;
  summary: AdminReportKpiVM[];
  userSummary: AdminReportKpiVM[];
  classroomSummary: AdminReportKpiVM[];
  channelSummary: AdminReportKpiVM[];
  activitySummary: AdminReportKpiVM[];
  monthlyUserGrowth: AdminTimeSeriesPointVM[];
  monthlyUsageByRole: AdminTimeSeriesPointVM[];
  monthlyAttendance: AdminTimeSeriesPointVM[];
  monthlyCompletedSessions: AdminTimeSeriesPointVM[];
  weeklyCompletedSessions: AdminTimeSeriesPointVM[];
  upcomingScheduledSessionsByWeek: AdminTimeSeriesPointVM[];
  inboxActivityByMonth: AdminTimeSeriesPointVM[];
  inboxReadRateByMonth: AdminTimeSeriesPointVM[];
  growthSeries: AdminTimeSeriesPointVM[];
  completedSessionsByTeacher: AdminRankedMetricVM[];
  completedSessionsByFamily: AdminRankedMetricVM[];
  channelUsage: AdminRankedMetricVM[];
  channelTypeMix: AdminRankedMetricVM[];
  notificationDispatchByChannel: AdminRankedMetricVM[];
  inboxActivityByVerb: AdminRankedMetricVM[];
}
