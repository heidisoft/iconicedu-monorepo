import type {
  AccountRow,
  ActivityFeedItemRow,
  ClassScheduleVM,
  AdminRankedMetricVM,
  AdminReportsDashboardVM,
  AdminTimeSeriesPointVM,
  ChannelLiveSessionParticipantRow,
  ChannelLiveSessionRow,
  ChannelMemberRow,
  ChannelRow,
  FamilyLinkRow,
  FamilyRow,
  LearningSpaceRow,
  MessageRow,
  NotificationDispatchJobRow,
  ProfileRow,
} from '@iconicedu/shared-types';
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import {
  getMonthProgressStatsByKey,
  getResolvedScheduleDisplayMonthKey,
  getScheduleDisplayStartOfWeek,
  splitSchedulesByTimeline,
} from '@iconicedu/ui-web/components/messages/tabs/messages-schedule-tab.utils';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { ACCOUNT_SELECT } from '@iconicedu/web/lib/accounts/constants/selects';
import {
  CHANNEL_MEMBER_SELECT,
  CHANNEL_SELECT,
} from '@iconicedu/web/lib/channels/constants/selects';
import {
  FAMILY_LINK_SELECT,
  FAMILY_SELECT,
} from '@iconicedu/web/lib/family/constants/selects';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import { LEARNING_SPACE_SELECT } from '@iconicedu/web/lib/spaces/constants/selects';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

type ReportDataSnapshot = {
  accounts: AccountRow[];
  profiles: ProfileRow[];
  families: FamilyRow[];
  familyLinks: FamilyLinkRow[];
  channels: ChannelRow[];
  channelMembers: ChannelMemberRow[];
  learningSpaces: LearningSpaceRow[];
  schedules: ClassScheduleVM[];
  messages: MessageRow[];
  activityFeedItems: ActivityFeedItemRow[];
  notificationDispatchJobs: NotificationDispatchJobRow[];
  liveSessions: ChannelLiveSessionRow[];
  liveSessionParticipants: ChannelLiveSessionParticipantRow[];
};

type ReportsBuildOptions = {
  now?: Date;
};

type TimeBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

const MONTH_BUCKET_COUNT = 12;
const WEEK_BUCKET_COUNT = 12;
const ATTENDED_STATUSES = new Set(['full', 'partial']);

function createMonthBuckets(now: Date): TimeBucket[] {
  const anchor = startOfMonth(subMonths(now, 1));

  return Array.from({ length: MONTH_BUCKET_COUNT }, (_, index) => {
    const start = startOfMonth(subMonths(anchor, MONTH_BUCKET_COUNT - 1 - index));
    return {
      key: format(start, 'yyyy-MM'),
      label: format(start, 'MMM yyyy'),
      start,
      end: endOfMonth(start),
    };
  });
}

function createCurrentInclusiveMonthBuckets(now: Date): TimeBucket[] {
  const anchor = startOfMonth(now);

  return Array.from({ length: MONTH_BUCKET_COUNT }, (_, index) => {
    const start = startOfMonth(subMonths(anchor, MONTH_BUCKET_COUNT - 1 - index));
    return {
      key: format(start, 'yyyy-MM'),
      label: format(start, 'MMM yyyy'),
      start,
      end: endOfMonth(start),
    };
  });
}

function createWeekBuckets(now: Date): TimeBucket[] {
  const anchor = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  return Array.from({ length: WEEK_BUCKET_COUNT }, (_, index) => {
    const start = startOfWeek(subWeeks(anchor, WEEK_BUCKET_COUNT - 1 - index), {
      weekStartsOn: 1,
    });
    return {
      key: format(start, 'yyyy-MM-dd'),
      label: format(start, 'MMM d'),
      start,
      end: endOfWeek(start, { weekStartsOn: 1 }),
    };
  });
}

function createUpcomingWeekBuckets(now: Date): TimeBucket[] {
  const anchor = startOfWeek(now, { weekStartsOn: 1 });

  return Array.from({ length: 8 }, (_, index) => {
    const start = startOfWeek(new Date(anchor), { weekStartsOn: 1 });
    start.setDate(start.getDate() + index * 7);

    return {
      key: format(start, 'yyyy-MM-dd'),
      label: format(start, 'MMM d'),
      start,
      end: endOfWeek(start, { weekStartsOn: 1 }),
    };
  });
}

export function createEmptyAdminReportsDashboardVM(
  now = new Date(),
): AdminReportsDashboardVM {
  return {
    generatedAt: now.toISOString(),
    summary: [],
    userSummary: [],
    classroomSummary: [],
    channelSummary: [],
    activitySummary: [],
    monthlyUserGrowth: [],
    monthlyUsageByRole: [],
    monthlyAttendance: [],
    monthlyCompletedSessions: [],
    weeklyCompletedSessions: [],
    upcomingScheduledSessionsByWeek: [],
    inboxActivityByMonth: [],
    inboxReadRateByMonth: [],
    growthSeries: [],
    completedSessionsByTeacher: [],
    completedSessionsByFamily: [],
    channelUsage: [],
    channelTypeMix: [],
    notificationDispatchByChannel: [],
    inboxActivityByVerb: [],
  };
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

function normalizeRole(value?: string | null) {
  return value?.trim() || 'unknown';
}

function normalizeChannelKind(value?: string | null) {
  return value?.trim() || 'unknown';
}

function getProfileLabel(profile?: ProfileRow | null) {
  if (!profile) {
    return 'Unknown';
  }

  const displayName = profile.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const firstName = profile.first_name?.trim() ?? '';
  const lastName = profile.last_name?.trim() ?? '';
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
  }

  return firstName || 'Unknown';
}

function getChannelLabel(channel?: ChannelRow | null) {
  const topic = channel?.topic?.trim();
  return topic || 'Untitled channel';
}

function incrementPoint(
  counts: Map<string, Map<string, number>>,
  bucketKey: string,
  seriesKey: string,
  delta = 1,
) {
  const seriesCounts = counts.get(bucketKey) ?? new Map<string, number>();
  seriesCounts.set(seriesKey, (seriesCounts.get(seriesKey) ?? 0) + delta);
  counts.set(bucketKey, seriesCounts);
}

function findBucketByTime(buckets: TimeBucket[], timestamp: number) {
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return (
    buckets.find(
      (bucket) =>
        timestamp >= bucket.start.getTime() && timestamp <= bucket.end.getTime(),
    ) ?? null
  );
}

function mapCountsToSeries(
  buckets: TimeBucket[],
  counts: Map<string, Map<string, number>>,
  seriesKeys: string[],
): AdminTimeSeriesPointVM[] {
  return buckets.flatMap((bucket) =>
    seriesKeys.map((seriesKey) => ({
      bucketStart: bucket.start.toISOString(),
      label: bucket.label,
      value: counts.get(bucket.key)?.get(seriesKey) ?? 0,
      series: seriesKey,
    })),
  );
}

function sortRankedMetrics(metrics: AdminRankedMetricVM[]) {
  return [...metrics].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }

    return left.label.localeCompare(right.label);
  });
}

function isCompletedScheduleForReports(schedule: ClassScheduleVM, now: Date) {
  if (schedule.status === 'completed') {
    return true;
  }

  if (schedule.status === 'cancelled') {
    return false;
  }

  return new Date(schedule.endAt).getTime() < now.getTime();
}

function getCompletedSessionTimestamp(session: ChannelLiveSessionRow) {
  return toTimestamp(session.ended_at ?? session.started_at);
}

function buildSummary(input: {
  accounts: AccountRow[];
  profiles: ProfileRow[];
  families: FamilyRow[];
  schedules: ClassScheduleVM[];
  messages: MessageRow[];
  liveSessions: ChannelLiveSessionRow[];
  now: Date;
}): AdminReportsDashboardVM['summary'] {
  const currentMonthStart = startOfMonth(input.now);
  const currentMonthEnd = endOfMonth(input.now);
  const currentMonthKey = getResolvedScheduleDisplayMonthKey(input.now, null);
  const scheduleTimelineBuckets = splitSchedulesByTimeline(input.schedules, input.now);
  const monthProgressStatsByKey = getMonthProgressStatsByKey(
    [...scheduleTimelineBuckets.past, ...scheduleTimelineBuckets.upcoming],
    input.now,
    null,
  );
  const monthMessageChannels = new Set<string>();
  const monthSessionChannels = new Set<string>();
  const completedSessionsThisMonth =
    monthProgressStatsByKey.get(currentMonthKey)?.completedCount ?? 0;

  input.messages.forEach((message) => {
    const createdAt = toTimestamp(message.created_at);
    if (
      Number.isFinite(createdAt) &&
      createdAt >= currentMonthStart.getTime() &&
      createdAt <= currentMonthEnd.getTime()
    ) {
      monthMessageChannels.add(message.channel_id);
    }
  });

  input.liveSessions.forEach((session) => {
    const completedAt = getCompletedSessionTimestamp(session);
    if (!Number.isFinite(completedAt)) {
      return;
    }

    if (
      completedAt >= currentMonthStart.getTime() &&
      completedAt <= currentMonthEnd.getTime()
    ) {
      monthSessionChannels.add(session.channel_id);
    }
  });

  const activeEducators = input.profiles.filter(
    (profile) => profile.kind === 'educator',
  ).length;

  return [
    {
      key: 'total-users',
      label: 'Total users',
      value: input.accounts.length,
      description: 'All accounts in this organization.',
    },
    {
      key: 'active-educators',
      label: 'Active educators',
      value: activeEducators,
      description: 'Educator profiles available to staff and families.',
    },
    {
      key: 'active-families',
      label: 'Active families',
      value: input.families.length,
      description: 'Families linked to learners in the organization.',
    },
    {
      key: 'completed-sessions-this-month',
      label: 'Completed sessions this month',
      value: completedSessionsThisMonth,
      description:
        'Past sessions counted with the same completion rule as homepage tiles.',
    },
    {
      key: 'active-channels-this-month',
      label: 'Active channels this month',
      value: new Set([...monthMessageChannels, ...monthSessionChannels]).size,
      description: 'Channels with message or session activity this month.',
    },
  ];
}

function buildClassroomSummary(input: {
  schedules: ClassScheduleVM[];
  now: Date;
}): AdminReportsDashboardVM['classroomSummary'] {
  const currentMonthKey = getResolvedScheduleDisplayMonthKey(input.now, null);
  const timelineBuckets = splitSchedulesByTimeline(input.schedules, input.now);
  const expandedSchedules = [...timelineBuckets.past, ...timelineBuckets.upcoming];
  const monthProgressStatsByKey = getMonthProgressStatsByKey(
    expandedSchedules,
    input.now,
    null,
  );
  const currentWeekStart = getScheduleDisplayStartOfWeek(input.now, null).getTime();
  const upcomingNext7DaysMs = new Date(input.now);
  upcomingNext7DaysMs.setDate(upcomingNext7DaysMs.getDate() + 7);
  const upcomingLimitMs = upcomingNext7DaysMs.getTime();

  const upcomingNext7Days = timelineBuckets.upcoming.filter((schedule) => {
    if (schedule.status === 'cancelled') {
      return false;
    }
    const startAt = new Date(schedule.startAt).getTime();
    return startAt >= input.now.getTime() && startAt <= upcomingLimitMs;
  }).length;

  const completedThisMonth =
    monthProgressStatsByKey.get(currentMonthKey)?.completedCount ?? 0;
  const upcomingThisWeek = timelineBuckets.upcoming.filter((schedule) => {
    if (schedule.status === 'cancelled') {
      return false;
    }

    const scheduleWeekStart = getScheduleDisplayStartOfWeek(
      schedule.startAt,
      null,
    ).getTime();
    return scheduleWeekStart === currentWeekStart;
  }).length;

  return [
    {
      key: 'scheduled-this-week',
      label: 'Sessions this week',
      value: upcomingThisWeek,
      description: 'Remaining scheduled classroom sessions in the current week.',
    },
    {
      key: 'upcoming-next-7-days',
      label: 'Upcoming next 7 days',
      value: upcomingNext7Days,
      description: 'Non-cancelled classroom sessions due in the next 7 days.',
    },
    {
      key: 'upcoming-this-week',
      label: 'Upcoming this week',
      value: upcomingThisWeek,
      description: 'Remaining sessions still ahead in the current week.',
    },
    {
      key: 'completed-this-month',
      label: 'Completed this month',
      value: completedThisMonth,
      description: 'Past sessions counted with the homepage progress rule.',
    },
  ];
}

function buildUserSummary(input: {
  accounts: AccountRow[];
  profiles: ProfileRow[];
  now: Date;
}): AdminReportsDashboardVM['userSummary'] {
  const currentMonthStart = startOfMonth(input.now).getTime();
  const currentMonthEnd = endOfMonth(input.now).getTime();
  const accountsThisMonth = input.accounts.filter((account) => {
    const createdAt = toTimestamp(account.created_at);
    return (
      Number.isFinite(createdAt) &&
      createdAt >= currentMonthStart &&
      createdAt <= currentMonthEnd
    );
  }).length;

  return [
    {
      key: 'educators',
      label: 'Educators',
      value: input.profiles.filter((profile) => profile.kind === 'educator').length,
      description: 'Educator profiles available in the organization.',
    },
    {
      key: 'guardians',
      label: 'Guardians',
      value: input.profiles.filter((profile) => profile.kind === 'guardian').length,
      description: 'Family and parent-facing profiles.',
    },
    {
      key: 'learners',
      label: 'Learners',
      value: input.profiles.filter((profile) => profile.kind === 'child').length,
      description: 'Learner profiles linked to active families and classes.',
    },
    {
      key: 'new-accounts-this-month',
      label: 'New this month',
      value: accountsThisMonth,
      description: 'Accounts created during the current calendar month.',
    },
  ];
}

function buildChannelSummary(input: {
  channels: ChannelRow[];
  messages: MessageRow[];
  now: Date;
}): AdminReportsDashboardVM['channelSummary'] {
  const currentMonthStart = startOfMonth(input.now).getTime();
  const currentMonthEnd = endOfMonth(input.now).getTime();
  const messagesThisMonth = input.messages.filter((message) => {
    const createdAt = toTimestamp(message.created_at);
    return (
      Number.isFinite(createdAt) &&
      createdAt >= currentMonthStart &&
      createdAt <= currentMonthEnd
    );
  }).length;

  return [
    {
      key: 'total-channels',
      label: 'Total channels',
      value: input.channels.length,
      description: 'All active channels in the organization.',
    },
    {
      key: 'direct-message-channels',
      label: 'Direct messages',
      value: input.channels.filter((channel) => channel.kind === 'dm').length,
      description: 'One-to-one direct message channels.',
    },
    {
      key: 'group-conversation-channels',
      label: 'Group conversations',
      value: input.channels.filter((channel) => channel.kind === 'group_dm').length,
      description: 'Group and class-style conversation channels.',
    },
    {
      key: 'messages-this-month',
      label: 'Messages this month',
      value: messagesThisMonth,
      description: 'Message volume across all channels this month.',
    },
  ];
}

function buildActivitySummary(input: {
  activityFeedItems: ActivityFeedItemRow[];
  notificationDispatchJobs: NotificationDispatchJobRow[];
  now: Date;
}): AdminReportsDashboardVM['activitySummary'] {
  const currentMonthStart = startOfMonth(input.now).getTime();
  const currentMonthEnd = endOfMonth(input.now).getTime();

  const currentMonthInbox = input.activityFeedItems.filter((item) => {
    const occurredAt = toTimestamp(item.occurred_at ?? item.created_at);
    return (
      Number.isFinite(occurredAt) &&
      occurredAt >= currentMonthStart &&
      occurredAt <= currentMonthEnd
    );
  });

  const currentMonthJobs = input.notificationDispatchJobs.filter((job) => {
    const createdAt = toTimestamp(job.created_at);
    return (
      Number.isFinite(createdAt) &&
      createdAt >= currentMonthStart &&
      createdAt <= currentMonthEnd
    );
  });

  return [
    {
      key: 'inbox-items-this-month',
      label: 'Inbox items this month',
      value: currentMonthInbox.length,
      description: 'Inbox activities created for recipients in the current month.',
    },
    {
      key: 'read-this-month',
      label: 'Read this month',
      value: currentMonthInbox.filter((item) => Boolean(item.read_at || item.is_read))
        .length,
      description: 'Inbox activities already marked as read.',
    },
    {
      key: 'unread-right-now',
      label: 'Unread right now',
      value: input.activityFeedItems.filter((item) => !(item.read_at || item.is_read))
        .length,
      description: 'Current unread inbox activities across recipients.',
    },
    {
      key: 'notifications-sent-this-month',
      label: 'Notifications sent this month',
      value: currentMonthJobs.filter((job) => job.status === 'succeeded').length,
      description: 'Dispatch jobs that completed successfully this month.',
    },
  ];
}

function buildMonthlyUserGrowth(
  accounts: AccountRow[],
  buckets: TimeBucket[],
): AdminTimeSeriesPointVM[] {
  const counts = new Map<string, Map<string, number>>();
  const seriesKeys = new Set<string>();

  accounts.forEach((account) => {
    const bucket = findBucketByTime(buckets, toTimestamp(account.created_at));
    if (!bucket) {
      return;
    }

    const role = normalizeRole(account.primary_role);
    seriesKeys.add(role);
    incrementPoint(counts, bucket.key, role);
  });

  return mapCountsToSeries(buckets, counts, Array.from(seriesKeys).sort());
}

function buildMonthlyUsageByRole(input: {
  messages: MessageRow[];
  liveSessionParticipants: ChannelLiveSessionParticipantRow[];
  profileById: Map<string, ProfileRow>;
  buckets: TimeBucket[];
}): AdminTimeSeriesPointVM[] {
  const counts = new Map<string, Map<string, number>>();
  const seriesKeys = new Set<string>();

  input.messages.forEach((message) => {
    const bucket = findBucketByTime(input.buckets, toTimestamp(message.created_at));
    if (!bucket) {
      return;
    }

    const role = normalizeRole(input.profileById.get(message.sender_profile_id)?.kind);
    seriesKeys.add(role);
    incrementPoint(counts, bucket.key, role);
  });

  input.liveSessionParticipants.forEach((participant) => {
    const bucket = findBucketByTime(
      input.buckets,
      toTimestamp(participant.first_joined_at ?? participant.created_at),
    );
    if (!bucket) {
      return;
    }

    const role = normalizeRole(input.profileById.get(participant.profile_id)?.kind);
    seriesKeys.add(role);
    incrementPoint(counts, bucket.key, role);
  });

  const keys = Array.from(seriesKeys).sort();
  return keys.length ? mapCountsToSeries(input.buckets, counts, keys) : [];
}

function buildMonthlyAttendance(input: {
  buckets: TimeBucket[];
  liveSessions: ChannelLiveSessionRow[];
  participantsBySessionId: Map<string, ChannelLiveSessionParticipantRow[]>;
}): AdminTimeSeriesPointVM[] {
  const sumsByBucket = new Map<string, { totalRate: number; count: number }>();

  input.liveSessions.forEach((session) => {
    if (session.status !== 'ended') {
      return;
    }

    const bucket = findBucketByTime(
      input.buckets,
      toTimestamp(session.ended_at ?? session.started_at),
    );
    if (!bucket) {
      return;
    }

    const participants = input.participantsBySessionId.get(session.id) ?? [];
    if (!participants.length) {
      return;
    }

    const attendedCount = participants.filter((participant) =>
      ATTENDED_STATUSES.has(participant.attendance_status ?? ''),
    ).length;
    const sessionRate = attendedCount / participants.length;
    const aggregate = sumsByBucket.get(bucket.key) ?? { totalRate: 0, count: 0 };
    aggregate.totalRate += sessionRate;
    aggregate.count += 1;
    sumsByBucket.set(bucket.key, aggregate);
  });

  return input.buckets.map((bucket) => {
    const aggregate = sumsByBucket.get(bucket.key);
    return {
      bucketStart: bucket.start.toISOString(),
      label: bucket.label,
      value: aggregate?.count
        ? Number((aggregate.totalRate / aggregate.count).toFixed(4))
        : 0,
      series: 'attendance_rate',
    };
  });
}

function buildMonthlyCompletedScheduleCounts(input: {
  schedules: ClassScheduleVM[];
  buckets: TimeBucket[];
  now: Date;
}): AdminTimeSeriesPointVM[] {
  const timelineBuckets = splitSchedulesByTimeline(input.schedules, input.now);
  const monthProgressStatsByKey = getMonthProgressStatsByKey(
    [...timelineBuckets.past, ...timelineBuckets.upcoming],
    input.now,
    null,
  );

  return input.buckets.map((bucket) => ({
    bucketStart: bucket.start.toISOString(),
    label: bucket.label,
    value: monthProgressStatsByKey.get(bucket.key)?.completedCount ?? 0,
    series: 'completed_sessions',
  }));
}

function buildWeeklyCompletedScheduleCounts(input: {
  schedules: ClassScheduleVM[];
  buckets: TimeBucket[];
  now: Date;
}): AdminTimeSeriesPointVM[] {
  const counts = new Map<string, number>();
  const timelineBuckets = splitSchedulesByTimeline(input.schedules, input.now);
  const expandedSchedules = [...timelineBuckets.past, ...timelineBuckets.upcoming];

  expandedSchedules.forEach((schedule) => {
    if (!isCompletedScheduleForReports(schedule, input.now)) {
      return;
    }

    const bucket = findBucketByTime(input.buckets, toTimestamp(schedule.startAt));
    if (!bucket) {
      return;
    }

    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  });

  return input.buckets.map((bucket) => ({
    bucketStart: bucket.start.toISOString(),
    label: bucket.label,
    value: counts.get(bucket.key) ?? 0,
    series: 'completed_sessions',
  }));
}

function buildGrowthSeries(input: {
  buckets: TimeBucket[];
  accounts: AccountRow[];
  families: FamilyRow[];
  channels: ChannelRow[];
  learningSpaces: LearningSpaceRow[];
}): AdminTimeSeriesPointVM[] {
  const sources = [
    { key: 'users', rows: input.accounts.map((row) => row.created_at) },
    { key: 'families', rows: input.families.map((row) => row.created_at) },
    { key: 'channels', rows: input.channels.map((row) => row.created_at) },
    { key: 'learning_spaces', rows: input.learningSpaces.map((row) => row.created_at) },
  ];

  return input.buckets.flatMap((bucket) =>
    sources.map((source) => ({
      bucketStart: bucket.start.toISOString(),
      label: bucket.label,
      value: source.rows.filter(
        (createdAt) => toTimestamp(createdAt) <= bucket.end.getTime(),
      ).length,
      series: source.key,
    })),
  );
}

function buildInboxActivityByMonth(input: {
  buckets: TimeBucket[];
  activityFeedItems: ActivityFeedItemRow[];
}): AdminTimeSeriesPointVM[] {
  const counts = new Map<string, Map<string, number>>();
  const seriesKeys = ['created', 'read'];

  input.activityFeedItems.forEach((item) => {
    const createdBucket = findBucketByTime(
      input.buckets,
      toTimestamp(item.occurred_at ?? item.created_at),
    );
    if (createdBucket) {
      incrementPoint(counts, createdBucket.key, 'created');
    }

    const readBucket = findBucketByTime(input.buckets, toTimestamp(item.read_at));
    if (readBucket) {
      incrementPoint(counts, readBucket.key, 'read');
    }
  });

  return mapCountsToSeries(input.buckets, counts, seriesKeys);
}

function buildInboxReadRateByMonth(input: {
  buckets: TimeBucket[];
  activityFeedItems: ActivityFeedItemRow[];
}): AdminTimeSeriesPointVM[] {
  const totals = new Map<string, { total: number; read: number }>();

  input.activityFeedItems.forEach((item) => {
    const bucket = findBucketByTime(
      input.buckets,
      toTimestamp(item.occurred_at ?? item.created_at),
    );
    if (!bucket) {
      return;
    }

    const current = totals.get(bucket.key) ?? { total: 0, read: 0 };
    current.total += 1;
    if (item.read_at || item.is_read) {
      current.read += 1;
    }
    totals.set(bucket.key, current);
  });

  return input.buckets.map((bucket) => {
    const current = totals.get(bucket.key);
    return {
      bucketStart: bucket.start.toISOString(),
      label: bucket.label,
      value: current?.total ? Number((current.read / current.total).toFixed(4)) : 0,
      series: 'read_rate',
    };
  });
}

function buildUpcomingScheduledSessionsByWeek(input: {
  schedules: ClassScheduleVM[];
  now: Date;
}): AdminTimeSeriesPointVM[] {
  const weekBuckets = createUpcomingWeekBuckets(input.now);
  const counts = new Map<string, number>();
  const upcoming = splitSchedulesByTimeline(input.schedules, input.now).upcoming;

  upcoming.forEach((schedule) => {
    if (schedule.status === 'cancelled') {
      return;
    }

    const bucket = findBucketByTime(weekBuckets, toTimestamp(schedule.startAt));
    if (!bucket) {
      return;
    }

    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  });

  return weekBuckets.map((bucket) => ({
    bucketStart: bucket.start.toISOString(),
    label: bucket.label,
    value: counts.get(bucket.key) ?? 0,
    series: 'scheduled_sessions',
  }));
}

function buildNotificationDispatchByChannel(input: {
  notificationDispatchJobs: NotificationDispatchJobRow[];
}): AdminRankedMetricVM[] {
  const counts = new Map<string, number>();
  const successCounts = new Map<string, number>();

  input.notificationDispatchJobs.forEach((job) => {
    counts.set(job.delivery_channel, (counts.get(job.delivery_channel) ?? 0) + 1);
    if (job.status === 'succeeded') {
      successCounts.set(
        job.delivery_channel,
        (successCounts.get(job.delivery_channel) ?? 0) + 1,
      );
    }
  });

  return sortRankedMetrics(
    Array.from(counts.entries()).map(([channel, value]) => ({
      id: channel,
      label: channel,
      value,
      secondaryValue: successCounts.get(channel) ?? 0,
      secondaryLabel: 'succeeded',
    })),
  );
}

function buildInboxActivityByVerb(input: {
  activityFeedItems: ActivityFeedItemRow[];
}): AdminRankedMetricVM[] {
  const counts = new Map<string, { total: number; unread: number }>();

  input.activityFeedItems.forEach((item) => {
    const key = item.verb?.trim() || 'unknown';
    const current = counts.get(key) ?? { total: 0, unread: 0 };
    current.total += 1;
    if (!(item.read_at || item.is_read)) {
      current.unread += 1;
    }
    counts.set(key, current);
  });

  return sortRankedMetrics(
    Array.from(counts.entries()).map(([verb, value]) => ({
      id: verb,
      label: verb,
      value: value.total,
      secondaryValue: value.unread,
      secondaryLabel: 'unread',
    })),
  ).slice(0, 8);
}

function buildTeacherRanking(input: {
  schedules: ClassScheduleVM[];
  profileById: Map<string, ProfileRow>;
  now: Date;
}): AdminRankedMetricVM[] {
  const counts = new Map<string, number>();
  const timelineBuckets = splitSchedulesByTimeline(input.schedules, input.now);
  const expandedSchedules = [...timelineBuckets.past, ...timelineBuckets.upcoming];

  expandedSchedules.forEach((schedule) => {
    if (!isCompletedScheduleForReports(schedule, input.now)) {
      return;
    }

    const educatorIds = new Set(
      schedule.participants
        .filter((participant) => participant.role === 'educator')
        .map((participant) => participant.ids.id),
    );

    educatorIds.forEach((teacherProfileId) => {
      counts.set(teacherProfileId, (counts.get(teacherProfileId) ?? 0) + 1);
    });
  });

  return sortRankedMetrics(
    Array.from(counts.entries()).map(([profileId, value]) => ({
      id: profileId,
      label: getProfileLabel(input.profileById.get(profileId)),
      value,
    })),
  ).slice(0, 8);
}

function buildFamilyRanking(input: {
  schedules: ClassScheduleVM[];
  profileById: Map<string, ProfileRow>;
  familyLinksByChildAccountId: Map<string, Set<string>>;
  familyById: Map<string, FamilyRow>;
  now: Date;
}): AdminRankedMetricVM[] {
  const counts = new Map<string, number>();
  const timelineBuckets = splitSchedulesByTimeline(input.schedules, input.now);
  const expandedSchedules = [...timelineBuckets.past, ...timelineBuckets.upcoming];

  expandedSchedules.forEach((schedule) => {
    if (!isCompletedScheduleForReports(schedule, input.now)) {
      return;
    }

    const familyIds = new Set<string>();
    schedule.participants.forEach((participant) => {
      const profile = input.profileById.get(participant.ids.id);
      if (profile?.kind !== 'child') {
        return;
      }

      const linkedFamilies = input.familyLinksByChildAccountId.get(profile.account_id);
      linkedFamilies?.forEach((familyId) => familyIds.add(familyId));
    });

    familyIds.forEach((familyId) => {
      counts.set(familyId, (counts.get(familyId) ?? 0) + 1);
    });
  });

  return sortRankedMetrics(
    Array.from(counts.entries()).map(([familyId, value]) => ({
      id: familyId,
      label: input.familyById.get(familyId)?.display_name ?? 'Unknown family',
      value,
    })),
  ).slice(0, 8);
}

function buildChannelUsage(input: {
  messages: MessageRow[];
  channelById: Map<string, ChannelRow>;
  participantCountByChannelId: Map<string, number>;
}): AdminRankedMetricVM[] {
  const counts = new Map<string, number>();

  input.messages.forEach((message) => {
    counts.set(message.channel_id, (counts.get(message.channel_id) ?? 0) + 1);
  });

  return sortRankedMetrics(
    Array.from(counts.entries()).map(([channelId, value]) => ({
      id: channelId,
      label: getChannelLabel(input.channelById.get(channelId)),
      value,
      secondaryValue: input.participantCountByChannelId.get(channelId) ?? 0,
      secondaryLabel: 'participants',
    })),
  ).slice(0, 8);
}

function buildChannelTypeMix(input: {
  messages: MessageRow[];
  channelById: Map<string, ChannelRow>;
}): AdminRankedMetricVM[] {
  const messageCounts = new Map<string, number>();
  const channelIdsByKind = new Map<string, Set<string>>();

  input.messages.forEach((message) => {
    const kind = normalizeChannelKind(input.channelById.get(message.channel_id)?.kind);
    messageCounts.set(kind, (messageCounts.get(kind) ?? 0) + 1);
    const channelIds = channelIdsByKind.get(kind) ?? new Set<string>();
    channelIds.add(message.channel_id);
    channelIdsByKind.set(kind, channelIds);
  });

  return sortRankedMetrics(
    Array.from(messageCounts.entries()).map(([kind, value]) => ({
      id: kind,
      label: kind,
      value,
      secondaryValue: channelIdsByKind.get(kind)?.size ?? 0,
      secondaryLabel: 'channels',
    })),
  );
}

export function buildAdminReportsDashboardVM(
  snapshot: ReportDataSnapshot,
  options: ReportsBuildOptions = {},
): AdminReportsDashboardVM {
  const now = options.now ?? new Date();
  const monthlyBuckets = createMonthBuckets(now);
  const monthlyCompletedSessionBuckets = createCurrentInclusiveMonthBuckets(now);
  const weeklyBuckets = createWeekBuckets(now);
  const profileById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const familyById = new Map(snapshot.families.map((family) => [family.id, family]));
  const channelById = new Map(snapshot.channels.map((channel) => [channel.id, channel]));
  const participantCountByChannelId = new Map<string, number>();
  const familyLinksByChildAccountId = new Map<string, Set<string>>();
  const participantsBySessionId = new Map<string, ChannelLiveSessionParticipantRow[]>();

  snapshot.channelMembers.forEach((member) => {
    participantCountByChannelId.set(
      member.channel_id,
      (participantCountByChannelId.get(member.channel_id) ?? 0) + 1,
    );
  });

  snapshot.familyLinks.forEach((link) => {
    const familyIds =
      familyLinksByChildAccountId.get(link.child_account_id) ?? new Set<string>();
    familyIds.add(link.family_id);
    familyLinksByChildAccountId.set(link.child_account_id, familyIds);
  });

  snapshot.liveSessionParticipants.forEach((participant) => {
    const participants = participantsBySessionId.get(participant.live_session_id) ?? [];
    participants.push(participant);
    participantsBySessionId.set(participant.live_session_id, participants);
  });

  return {
    generatedAt: now.toISOString(),
    summary: buildSummary({
      accounts: snapshot.accounts,
      profiles: snapshot.profiles,
      families: snapshot.families,
      schedules: snapshot.schedules,
      messages: snapshot.messages,
      liveSessions: snapshot.liveSessions,
      now,
    }),
    userSummary: buildUserSummary({
      accounts: snapshot.accounts,
      profiles: snapshot.profiles,
      now,
    }),
    classroomSummary: buildClassroomSummary({
      schedules: snapshot.schedules,
      now,
    }),
    channelSummary: buildChannelSummary({
      channels: snapshot.channels,
      messages: snapshot.messages,
      now,
    }),
    activitySummary: buildActivitySummary({
      activityFeedItems: snapshot.activityFeedItems,
      notificationDispatchJobs: snapshot.notificationDispatchJobs,
      now,
    }),
    monthlyUserGrowth: buildMonthlyUserGrowth(snapshot.accounts, monthlyBuckets),
    monthlyUsageByRole: buildMonthlyUsageByRole({
      messages: snapshot.messages,
      liveSessionParticipants: snapshot.liveSessionParticipants,
      profileById,
      buckets: monthlyBuckets,
    }),
    monthlyAttendance: buildMonthlyAttendance({
      buckets: monthlyBuckets,
      liveSessions: snapshot.liveSessions,
      participantsBySessionId,
    }),
    monthlyCompletedSessions: buildMonthlyCompletedScheduleCounts({
      schedules: snapshot.schedules,
      buckets: monthlyCompletedSessionBuckets,
      now,
    }),
    weeklyCompletedSessions: buildWeeklyCompletedScheduleCounts({
      schedules: snapshot.schedules,
      buckets: weeklyBuckets,
      now,
    }),
    upcomingScheduledSessionsByWeek: buildUpcomingScheduledSessionsByWeek({
      schedules: snapshot.schedules,
      now,
    }),
    inboxActivityByMonth: buildInboxActivityByMonth({
      buckets: monthlyBuckets,
      activityFeedItems: snapshot.activityFeedItems,
    }),
    inboxReadRateByMonth: buildInboxReadRateByMonth({
      buckets: monthlyBuckets,
      activityFeedItems: snapshot.activityFeedItems,
    }),
    growthSeries: buildGrowthSeries({
      buckets: monthlyBuckets,
      accounts: snapshot.accounts,
      families: snapshot.families,
      channels: snapshot.channels,
      learningSpaces: snapshot.learningSpaces,
    }),
    completedSessionsByTeacher: buildTeacherRanking({
      schedules: snapshot.schedules,
      profileById,
      now,
    }),
    completedSessionsByFamily: buildFamilyRanking({
      schedules: snapshot.schedules,
      profileById,
      familyLinksByChildAccountId,
      familyById,
      now,
    }),
    channelUsage: buildChannelUsage({
      messages: snapshot.messages,
      channelById,
      participantCountByChannelId,
    }),
    channelTypeMix: buildChannelTypeMix({
      messages: snapshot.messages,
      channelById,
    }),
    notificationDispatchByChannel: buildNotificationDispatchByChannel({
      notificationDispatchJobs: snapshot.notificationDispatchJobs,
    }),
    inboxActivityByVerb: buildInboxActivityByVerb({
      activityFeedItems: snapshot.activityFeedItems,
    }),
  };
}

async function loadReportSnapshot(orgId: string, now: Date): Promise<ReportDataSnapshot> {
  const supabase = createSupabaseServiceClient();
  const monthlyBuckets = createMonthBuckets(now);
  const weeklyBuckets = createWeekBuckets(now);
  const oldestWindowStart = monthlyBuckets[0]?.start ?? weeklyBuckets[0]?.start ?? now;
  const oldestWindowStartIso = oldestWindowStart.toISOString();

  const [
    accountsResponse,
    profilesResponse,
    familiesResponse,
    familyLinksResponse,
    channelsResponse,
    channelMembersResponse,
    learningSpacesResponse,
    schedules,
    messagesResponse,
    activityFeedItemsResponse,
    notificationDispatchJobsResponse,
    liveSessionsResponse,
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<AccountRow[]>(),
    supabase
      .from('profiles')
      .select(
        'id,org_id,account_id,kind,display_name,first_name,last_name,avatar_source,avatar_url,status,created_at,updated_at',
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<ProfileRow[]>(),
    supabase
      .from('families')
      .select(FAMILY_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<FamilyRow[]>(),
    supabase
      .from('family_links')
      .select(FAMILY_LINK_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<FamilyLinkRow[]>(),
    supabase
      .from('channels')
      .select(CHANNEL_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<ChannelRow[]>(),
    supabase
      .from('channel_members')
      .select(CHANNEL_MEMBER_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<ChannelMemberRow[]>(),
    supabase
      .from('learning_spaces')
      .select(LEARNING_SPACE_SELECT)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<LearningSpaceRow[]>(),
    buildClassSchedulesByOrg(supabase, orgId),
    supabase
      .from('messages')
      .select(
        'id,org_id,channel_id,sender_profile_id,type,created_at,visibility_type,updated_at,deleted_at',
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', oldestWindowStartIso)
      .returns<MessageRow[]>(),
    supabase
      .from('activity_feed_items')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('occurred_at', oldestWindowStartIso)
      .returns<ActivityFeedItemRow[]>(),
    supabase
      .from('notification_dispatch_jobs')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', oldestWindowStartIso)
      .returns<NotificationDispatchJobRow[]>(),
    supabase
      .from('channel_live_sessions')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('started_at', oldestWindowStartIso)
      .returns<ChannelLiveSessionRow[]>(),
  ]);

  [
    accountsResponse,
    profilesResponse,
    familiesResponse,
    familyLinksResponse,
    channelsResponse,
    channelMembersResponse,
    learningSpacesResponse,
    { data: schedules, error: null },
    messagesResponse,
    activityFeedItemsResponse,
    notificationDispatchJobsResponse,
    liveSessionsResponse,
  ].forEach((response) => {
    if ('error' in response && response.error) {
      throw new Error(response.error.message);
    }
  });

  const sessionIds = (liveSessionsResponse.data ?? []).map((session) => session.id);
  const liveSessionParticipantsResponse = sessionIds.length
    ? await supabase
        .from('channel_live_session_participants')
        .select('*')
        .eq('org_id', orgId)
        .in('live_session_id', sessionIds)
        .is('deleted_at', null)
        .returns<ChannelLiveSessionParticipantRow[]>()
    : { data: [] as ChannelLiveSessionParticipantRow[], error: null };

  if (
    'error' in liveSessionParticipantsResponse &&
    liveSessionParticipantsResponse.error
  ) {
    throw new Error(liveSessionParticipantsResponse.error.message);
  }

  return {
    accounts: accountsResponse.data ?? [],
    profiles: profilesResponse.data ?? [],
    families: familiesResponse.data ?? [],
    familyLinks: familyLinksResponse.data ?? [],
    channels: channelsResponse.data ?? [],
    channelMembers: channelMembersResponse.data ?? [],
    learningSpaces: learningSpacesResponse.data ?? [],
    schedules,
    messages: messagesResponse.data ?? [],
    activityFeedItems: activityFeedItemsResponse.data ?? [],
    notificationDispatchJobs: notificationDispatchJobsResponse.data ?? [],
    liveSessions: liveSessionsResponse.data ?? [],
    liveSessionParticipants: liveSessionParticipantsResponse.data ?? [],
  };
}

export async function getAdminReportsDashboard(
  orgId: string,
  options: ReportsBuildOptions = {},
): Promise<AdminReportsDashboardVM> {
  if (!orgId) {
    return createEmptyAdminReportsDashboardVM(options.now);
  }

  const authContext = await requireAdminOrgContext(orgId, { allowStaff: true });
  if (!authContext.ok) {
    throw new Error(authContext.message);
  }

  const now = options.now ?? new Date();
  const snapshot = await loadReportSnapshot(orgId, now);
  return buildAdminReportsDashboardVM(snapshot, { now });
}
