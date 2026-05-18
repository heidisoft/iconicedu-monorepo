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

export interface AdminActivityFeedActorVM {
  profileId: string;
  displayName: string;
  kind?: string | null;
}

export interface AdminActivityFeedChannelVM {
  channelId: string;
  label: string;
  kind?: string | null;
}

export interface AdminActivityFeedDeliveryChannelVM {
  channel: 'push' | 'email' | 'sms' | string;
  status: string;
  createdAt: string;
  lastError?: string | null;
}

export interface AdminActivityFeedPipelineJobVM {
  id: string;
  kind: string;
  status: string;
  attemptCount: number;
  runAt: string;
  createdAt: string;
  nextAttemptAt?: string | null;
  lastError?: string | null;
}

export interface AdminActivityFeedReminderJobVM {
  id: string;
  jobType: string;
  status: string;
  targetKind: string;
  targetId: string;
  runAt: string;
  occurrenceStartAt?: string | null;
  reminderOffsetMinutes?: number | null;
  attemptCount: number;
  dispatchedAt?: string | null;
  lastError?: string | null;
  dispatchResult?: string | null;
}

export interface AdminActivityFeedItemVM {
  id: string;
  sourceEventId?: string | null;
  verb: string;
  tabKey: string;
  summary: string;
  recipient: AdminActivityFeedActorVM;
  actor?: AdminActivityFeedActorVM | null;
  channel?: AdminActivityFeedChannelVM | null;
  scopeLabel: string;
  importance?: string | null;
  isRead: boolean;
  occurredAt: string;
  createdAt: string;
  dedupeKey?: string | null;
  deliveryChannels: AdminActivityFeedDeliveryChannelVM[];
  pipelineJobs: AdminActivityFeedPipelineJobVM[];
  reminderJobs: AdminActivityFeedReminderJobVM[];
}

export interface AdminActivityFeedVerbSummaryVM {
  verb: string;
  count: number;
  unreadCount: number;
  recipientCount: number;
  channelCount: number;
  latestOccurredAt: string;
}

export interface AdminActivityFeedAuditVM {
  generatedAt: string;
  totalCount: number;
  unreadCount: number;
  pipelineJobCount: number;
  reminderJobCount: number;
  verbSummaries: AdminActivityFeedVerbSummaryVM[];
  items: AdminActivityFeedItemVM[];
}
