import type {
  ClassScheduleVM,
  ClassScheduleParticipantVM,
  ClassSchedulePatchVM,
  EventSourceVM,
  RecurrenceVM,
  SessionCompletionVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import {
  getResolvedScheduleDisplayMonthKey,
  getScheduleDisplayStartOfDay,
  getScheduleDisplayStartOfWeek,
  getScheduleDisplayMonthRange,
  getMonthProgressStatsByKey,
  groupSchedulesByMonth,
  splitSchedulesByTimeline,
  toMonthGroups,
  type ClassSession,
} from '@iconicedu/ui-web/components/messages/tabs/messages-schedule-tab.utils';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { listSessionCompletions } from '@iconicedu/web/lib/api/session-completions';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardInfographicRole = 'parents' | 'students' | 'tutors';

export interface DashboardInfographicRoleMetrics {
  upcomingSessionsThisWeek: number;
  completedClassesThisMonth: number;
  activeSubjectsCount: number;
  activeSubjectsLabel: string;
}

export interface DashboardUpcomingSessionListItem {
  session: ClassSession;
  channelId?: string | null;
  joinHref: string;
  chatHref: string;
  weekBucket: 'today' | 'this-week' | 'next-week';
}

export interface DashboardUpcomingSessionsSectionPage {
  items: DashboardUpcomingSessionListItem[];
  total: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardUpcomingSessionsPage {
  today: DashboardUpcomingSessionsSectionPage;
  thisWeek: DashboardUpcomingSessionsSectionPage;
  nextWeek: DashboardUpcomingSessionsSectionPage;
}

export interface DashboardHomeInfographicMetrics {
  activeRole: DashboardInfographicRole;
  isStaffView: boolean;
  metricsByRole: Record<DashboardInfographicRole, DashboardInfographicRoleMetrics>;
  upcomingSessionsPage: DashboardUpcomingSessionsPage;
  completedSessionsPending: SessionCompletionVM[];
  sessionCompletionSummary: {
    completed: number;
    pending: number;
  } | null;
  browseHref: string;
  calendarHref: string;
  notificationsHref: string;
}

const DEFAULT_PAGE_SIZE = 5;

const ZERO_METRICS: DashboardInfographicRoleMetrics = {
  upcomingSessionsThisWeek: 0,
  completedClassesThisMonth: 0,
  activeSubjectsCount: 0,
  activeSubjectsLabel: 'No active subjects yet',
};

const endOfWeekSunday = (date: Date) => {
  const result = new Date(date);
  result.setDate(result.getDate() + 6);
  return result;
};

const cloneZeroMetrics = (): DashboardInfographicRoleMetrics => ({ ...ZERO_METRICS });

function resolveActiveRole(
  currentUserProfile: UserProfileVM | null,
): DashboardInfographicRole {
  if (currentUserProfile?.kind === 'guardian') return 'parents';
  if (currentUserProfile?.kind === 'child') return 'students';
  if (currentUserProfile?.kind === 'educator') return 'tutors';
  return 'parents';
}

function resolveScopedProfileIds(
  currentUserProfile: UserProfileVM | null,
  activeRole: DashboardInfographicRole,
): Set<string> {
  if (!currentUserProfile) {
    return new Set<string>();
  }

  if (activeRole === 'parents' && currentUserProfile.kind === 'guardian') {
    return new Set(
      (currentUserProfile.children?.items ?? []).map((child) => child.ids.id),
    );
  }

  if (activeRole === 'students' && currentUserProfile.kind === 'child') {
    return new Set([currentUserProfile.ids.id]);
  }

  if (activeRole === 'tutors' && currentUserProfile.kind === 'educator') {
    return new Set([currentUserProfile.ids.id]);
  }

  return new Set<string>();
}

function toActiveSubjectsLabel(subjects: string[]): string {
  if (!subjects.length) {
    return ZERO_METRICS.activeSubjectsLabel;
  }

  if (subjects.length <= 3) {
    return subjects.join(', ');
  }

  return `${subjects.slice(0, 3).join(', ')} +${subjects.length - 3} more`;
}

function toActiveStudentsLabel(activeStudentsCount: number): string {
  if (!activeStudentsCount) {
    return 'No active students yet';
  }

  return activeStudentsCount === 1
    ? '1 active student'
    : `${activeStudentsCount} active students`;
}

function getProfileRoleForScope(activeRole: DashboardInfographicRole) {
  if (activeRole === 'tutors') return 'educator';
  return 'child';
}

function getScopedClassroomSchedules(input: {
  schedules: ClassScheduleVM[];
  scopedProfileIds: Set<string>;
  activeRole: DashboardInfographicRole;
}) {
  const scopedRole = getProfileRoleForScope(input.activeRole);

  return input.schedules.filter((schedule) => {
    if (schedule.source.kind !== 'class_session') {
      return false;
    }

    return schedule.participants.some((participant) => {
      if (!input.scopedProfileIds.has(participant.ids.id)) {
        return false;
      }
      return participant.role === scopedRole;
    });
  });
}

function getViewerParticipantNames(input: {
  schedule: ReturnType<typeof splitSchedulesByTimeline>['upcoming'][number];
  activeRole: DashboardInfographicRole;
  isStaffView: boolean;
}): string[] {
  const targetRoles = input.isStaffView
    ? null
    : input.activeRole === 'parents'
      ? new Set(['child', 'educator'])
      : input.activeRole === 'tutors'
        ? new Set(['child'])
        : new Set(['educator']);

  const names = new Set<string>();

  input.schedule.participants.forEach((participant) => {
    if (targetRoles && !targetRoles.has(participant.role)) {
      return;
    }
    const name = participant.displayName?.trim();
    if (name) {
      names.add(name);
    }
  });

  return Array.from(names);
}

function buildUpcomingSessionPage(input: {
  upcomingSchedules: ReturnType<typeof splitSchedulesByTimeline>['upcoming'];
  orgSlug: string;
  pageSize: number;
  now: Date;
  activeRole: DashboardInfographicRole;
  isStaffView: boolean;
  timezone?: string | null;
}): DashboardUpcomingSessionsPage {
  const getBaseScheduleId = (sessionId: string) => {
    const separatorIndex = sessionId.indexOf('__');
    return separatorIndex === -1 ? sessionId : sessionId.slice(0, separatorIndex);
  };

  const joinHrefByScheduleId = new Map<string, string>();
  const chatHrefByScheduleId = new Map<string, string>();
  const titleByScheduleId = new Map<string, string>();
  const participantNamesByScheduleId = new Map<string, string[]>();

  input.upcomingSchedules.forEach((schedule) => {
    const joinHref =
      schedule.source.kind === 'class_session' && schedule.source.channelId
        ? `/${input.orgSlug}/s/${schedule.source.channelId}`
        : `/${input.orgSlug}/class-schedule`;
    joinHrefByScheduleId.set(schedule.ids.id, joinHref);
    const chatHref =
      schedule.source.kind === 'class_session' && schedule.source.channelId
        ? `/${input.orgSlug}/s/${schedule.source.channelId}`
        : `/${input.orgSlug}/s`;
    chatHrefByScheduleId.set(schedule.ids.id, chatHref);
    titleByScheduleId.set(schedule.ids.id, schedule.title);
    participantNamesByScheduleId.set(
      schedule.ids.id,
      getViewerParticipantNames({
        schedule,
        activeRole: input.activeRole,
        isStaffView: input.isStaffView,
      }),
    );
  });

  const grouped = groupSchedulesByMonth(input.upcomingSchedules, input.timezone);
  const flatSessions = toMonthGroups(grouped, input.now, input.timezone).flatMap(
    (group) => group.sessions,
  );

  const currentWeekStart = getScheduleDisplayStartOfWeek(
    input.now,
    input.timezone ?? null,
  ).getTime();

  const items = flatSessions.map((session) => {
    const baseScheduleId = getBaseScheduleId(session.id);
    const sessionSchedule =
      input.upcomingSchedules.find((schedule) => schedule.ids.id === session.id) ??
      input.upcomingSchedules.find((schedule) => schedule.ids.id === baseScheduleId);
    const className =
      titleByScheduleId.get(session.id) ??
      titleByScheduleId.get(baseScheduleId) ??
      session.label;
    const participantNames =
      participantNamesByScheduleId.get(session.id) ??
      participantNamesByScheduleId.get(baseScheduleId) ??
      [];
    const timeLabel = participantNames.length
      ? `${session.time} · ${participantNames.join(', ')}`
      : session.time;
    const sessionWeekStart = getScheduleDisplayStartOfWeek(
      sessionSchedule?.startAt ?? input.now,
      input.timezone ?? null,
    ).getTime();

    return {
      session: {
        ...session,
        label: className,
        time: timeLabel,
      },
      channelId:
        sessionSchedule?.source.kind === 'class_session'
          ? (sessionSchedule.source.channelId ?? null)
          : null,
      joinHref:
        joinHrefByScheduleId.get(session.id) ?? `/${input.orgSlug}/class-schedule`,
      chatHref: chatHrefByScheduleId.get(session.id) ?? `/${input.orgSlug}/s`,
      weekBucket: session.isToday
        ? 'today'
        : sessionWeekStart === currentWeekStart
          ? 'this-week'
          : 'next-week',
    } satisfies DashboardUpcomingSessionListItem;
  });

  const buildSectionPage = (
    sectionItems: DashboardUpcomingSessionListItem[],
  ): DashboardUpcomingSessionsSectionPage => ({
    items: sectionItems,
    total: sectionItems.length,
    pageSize: input.pageSize,
    totalPages: Math.max(1, Math.ceil(sectionItems.length / input.pageSize)),
  });

  return {
    today: buildSectionPage(items.filter((item) => item.weekBucket === 'today')),
    thisWeek: buildSectionPage(items.filter((item) => item.weekBucket === 'this-week')),
    nextWeek: buildSectionPage(items.filter((item) => item.weekBucket === 'next-week')),
  };
}

function countActiveUpcomingSessions(
  section: DashboardUpcomingSessionsSectionPage,
): number {
  return section.items.filter((item) => item.session.status !== 'cancelled').length;
}

type ApiSpaceRow = {
  id: string;
  status: string | null;
  subject: string | null;
  title: string | null;
};

function mapApiSpaceRow(row: Record<string, unknown>): ApiSpaceRow {
  return {
    id: row.id as string,
    status: (row.status as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    title: (row.title as string | null) ?? null,
  };
}

function mapApiScheduleRow(row: Record<string, unknown>): ClassScheduleVM {
  const orgId = row.org_id as string;
  const recurrenceRows = row.recurrence as Record<string, unknown>[] | null;
  const recurrenceRow = recurrenceRows?.[0];

  const recurrence: RecurrenceVM | undefined = recurrenceRow
    ? {
        ids: { id: recurrenceRow.id as string, orgId },
        rule: {
          frequency: recurrenceRow.frequency as RecurrenceVM['rule']['frequency'],
          interval: (recurrenceRow.interval as number | null) ?? undefined,
          byWeekday:
            (recurrenceRow.byday as
              | string[]
              | null as RecurrenceVM['rule']['byWeekday']) ?? undefined,
          count: (recurrenceRow.count as number | null) ?? undefined,
          until: (recurrenceRow.until as string | null) ?? undefined,
          timezone: (recurrenceRow.timezone as string | null) ?? undefined,
        },
        exceptions: ((recurrenceRow.exceptions as Record<string, unknown>[]) ?? []).map(
          (ex) => ({
            occurrenceKey: ex.occurrence_key as string,
            reason: (ex.reason as string | null) ?? undefined,
          }),
        ),
        overrides: ((recurrenceRow.overrides as Record<string, unknown>[]) ?? []).map(
          (ov) => ({
            occurrenceKey: ov.occurrence_key as string,
            patch: ov.patch as ClassSchedulePatchVM,
          }),
        ),
      }
    : undefined;

  const sourceLearningSpace = row.source_learning_space as {
    archived_at?: string | null;
    status?: string | null;
  } | null;
  const sourceKind = row.source_kind as string;

  let source: EventSourceVM;
  if (sourceKind === 'class_session') {
    source = {
      kind: 'class_session',
      learningSpaceId: row.source_learning_space_id as string,
      channelId: (row.source_channel_id as string | null) ?? undefined,
      sessionId: (row.source_session_id as string | null) ?? undefined,
      archivedAt: sourceLearningSpace?.archived_at ?? null,
      learningSpaceStatus: sourceLearningSpace?.status ?? null,
    };
  } else if (sourceKind === 'availability_block') {
    source = {
      kind: 'availability_block',
      ownerUserId: row.source_owner_user_id as string,
    };
  } else {
    source = {
      kind: 'manual',
      createdByUserId: row.source_created_by_user_id as string,
      relatedTo: row.source_related_learning_space_id
        ? { kind: 'learning_space', id: row.source_related_learning_space_id as string }
        : undefined,
    };
  }

  const participants: ClassScheduleParticipantVM[] = (
    (row.participants as Record<string, unknown>[]) ?? []
  ).map((p) => ({
    ids: { id: p.profile_id as string, orgId },
    role: p.role as ClassScheduleParticipantVM['role'],
    status: (p.status as ClassScheduleParticipantVM['status'] | null) ?? undefined,
    displayName: (p.display_name as string | null) ?? undefined,
    avatarUrl: (p.avatar_url as string | null) ?? null,
    themeKey: (p.theme_key as ClassScheduleParticipantVM['themeKey'] | null) ?? undefined,
  }));

  return {
    ids: { id: row.id as string, orgId },
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    meetingLink: (row.meeting_link as string | null) ?? null,
    startAt: row.start_at as string,
    endAt: row.end_at as string,
    timezone: (row.timezone as string | null) ?? undefined,
    status: row.status as ClassScheduleVM['status'],
    visibility: row.visibility as ClassScheduleVM['visibility'],
    themeKey: (row.theme_key as ClassScheduleVM['themeKey'] | null) ?? undefined,
    participants,
    source,
    recurrence,
    audit: {
      createdAt: row.created_at as string,
      createdBy: row.created_by as string,
      updatedAt: (row.updated_at as string | null) ?? undefined,
      updatedBy: (row.updated_by as string | null) ?? undefined,
    },
  };
}

function getLearningSpaceIdFromSchedule(schedule: ClassScheduleVM): string | null {
  if (schedule.source.kind !== 'class_session') return null;
  return 'learningSpaceId' in schedule.source ? schedule.source.learningSpaceId : null;
}

async function buildActiveRoleMetrics(input: {
  supabase: SupabaseClient;
  orgId: string;
  scopedProfileIds: Set<string>;
  activeRole: DashboardInfographicRole;
  isStaffView: boolean;
  now: Date;
  orgSlug: string;
  pageSize: number;
  timezone?: string | null;
}): Promise<{
  metrics: DashboardInfographicRoleMetrics;
  upcomingSessionsPage: DashboardUpcomingSessionsPage;
}> {
  if (!input.isStaffView && !input.scopedProfileIds.size) {
    return {
      metrics: cloneZeroMetrics(),
      upcomingSessionsPage: {
        today: { items: [], total: 0, pageSize: input.pageSize, totalPages: 1 },
        thisWeek: { items: [], total: 0, pageSize: input.pageSize, totalPages: 1 },
        nextWeek: { items: [], total: 0, pageSize: input.pageSize, totalPages: 1 },
      },
    };
  }

  const apiClient = createApiClient(input.supabase);
  const [rawSchedules, rawSpaces] = await Promise.all([
    apiClient.get<Record<string, unknown>[]>('/schedules', { orgId: input.orgId }),
    apiClient.get<Record<string, unknown>[]>('/spaces', { orgId: input.orgId }),
  ]);

  const schedules = (rawSchedules ?? []).map(mapApiScheduleRow);
  const allSpaces = (rawSpaces ?? []).map(mapApiSpaceRow);

  const scopedSchedules = input.isStaffView
    ? schedules.filter((schedule) => schedule.source.kind === 'class_session')
    : getScopedClassroomSchedules({
        schedules,
        scopedProfileIds: input.scopedProfileIds,
        activeRole: input.activeRole,
      });

  if (!scopedSchedules.length) {
    return {
      metrics: cloneZeroMetrics(),
      upcomingSessionsPage: {
        today: { items: [], total: 0, pageSize: input.pageSize, totalPages: 1 },
        thisWeek: { items: [], total: 0, pageSize: input.pageSize, totalPages: 1 },
        nextWeek: { items: [], total: 0, pageSize: input.pageSize, totalPages: 1 },
      },
    };
  }

  const weekStartDate = getScheduleDisplayStartOfWeek(input.now, input.timezone ?? null);
  const weekStartMs = weekStartDate.getTime();
  const nextWeekEndDate = (() => {
    const nextWeekEnd = endOfWeekSunday(weekStartDate);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    return nextWeekEnd;
  })();
  const nextWeekEndMs = nextWeekEndDate.getTime();
  const scheduleReadRange = getScheduleDisplayMonthRange(
    [input.now, nextWeekEndDate],
    input.timezone ?? null,
  );
  const timelineBuckets = splitSchedulesByTimeline(
    scopedSchedules,
    input.now,
    scheduleReadRange,
  );
  const upcomingSchedulesThisAndNextWeek = timelineBuckets.upcoming.filter((schedule) => {
    const scheduleDayMs = getScheduleDisplayStartOfDay(
      schedule.startAt,
      input.timezone ?? null,
    ).getTime();
    return scheduleDayMs >= weekStartMs && scheduleDayMs <= nextWeekEndMs;
  });
  const monthProgressStatsByKey = getMonthProgressStatsByKey(
    [...timelineBuckets.past, ...timelineBuckets.upcoming],
    input.now,
    input.timezone,
  );
  const currentMonthKey = getResolvedScheduleDisplayMonthKey(
    input.now,
    input.timezone ?? null,
  );
  const completedClassesThisMonth =
    monthProgressStatsByKey.get(currentMonthKey)?.completedCount ?? 0;

  const activeLearningSpaces = allSpaces.filter((space) => space.status === 'active');
  const activeLearningSpaceIds = new Set(activeLearningSpaces.map((space) => space.id));

  const activeSubjects = input.isStaffView
    ? activeLearningSpaces
        .map((space) => space.title?.trim())
        .filter((title): title is string => Boolean(title))
    : Array.from(
        new Set(
          scopedSchedules.flatMap((schedule) => {
            const learningSpaceId = getLearningSpaceIdFromSchedule(schedule);
            if (!learningSpaceId || !activeLearningSpaceIds.has(learningSpaceId)) {
              return [];
            }
            const space = activeLearningSpaces.find(
              (candidate) => candidate.id === learningSpaceId,
            );
            const subject = space?.subject?.trim();
            return subject ? [subject] : [];
          }),
        ),
      );

  const activeStudentsCount =
    input.activeRole === 'tutors'
      ? (() => {
          const activeStudentIds = new Set<string>();

          scopedSchedules.forEach((schedule) => {
            if (schedule.source.kind !== 'class_session') return;
            const learningSpaceId = getLearningSpaceIdFromSchedule(schedule);
            if (!learningSpaceId || !activeLearningSpaceIds.has(learningSpaceId)) return;

            schedule.participants.forEach((participant) => {
              if (participant.role === 'child') {
                activeStudentIds.add(participant.ids.id);
              }
            });
          });

          return activeStudentIds.size;
        })()
      : 0;

  const upcomingSessionsPage = buildUpcomingSessionPage({
    upcomingSchedules: upcomingSchedulesThisAndNextWeek,
    orgSlug: input.orgSlug,
    pageSize: input.pageSize,
    now: input.now,
    activeRole: input.activeRole,
    isStaffView: input.isStaffView,
    timezone: input.timezone,
  });

  return {
    metrics: {
      upcomingSessionsThisWeek:
        countActiveUpcomingSessions(upcomingSessionsPage.today) +
        countActiveUpcomingSessions(upcomingSessionsPage.thisWeek),
      completedClassesThisMonth,
      activeSubjectsCount:
        input.activeRole === 'tutors' ? activeStudentsCount : activeSubjects.length,
      activeSubjectsLabel: input.isStaffView
        ? 'Manage classrooms'
        : input.activeRole === 'tutors'
          ? toActiveStudentsLabel(activeStudentsCount)
          : toActiveSubjectsLabel(activeSubjects),
    },
    upcomingSessionsPage,
  };
}

export async function buildDashboardHomeInfographicMetrics(input: {
  supabase: SupabaseClient;
  orgId: string;
  orgSlug: string;
  currentUserProfile: UserProfileVM | null;
  now?: Date;
  pageSize?: number;
  timezone?: string | null;
  sessionCompletionCarouselEnabled?: boolean;
}): Promise<DashboardHomeInfographicMetrics> {
  const now = input.now ?? new Date();
  const pageSize = Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE));
  const activeRole = resolveActiveRole(input.currentUserProfile);
  const isStaffView =
    input.currentUserProfile?.kind === 'staff' ||
    input.currentUserProfile?.kind === 'system';
  const scopedProfileIds = resolveScopedProfileIds(input.currentUserProfile, activeRole);

  const activeRoleData = await buildActiveRoleMetrics({
    supabase: input.supabase,
    orgId: input.orgId,
    scopedProfileIds,
    activeRole,
    isStaffView,
    now,
    orgSlug: input.orgSlug,
    pageSize,
    timezone: input.timezone ?? input.currentUserProfile?.prefs?.timezone ?? null,
  });
  const sessionCompletions =
    input.sessionCompletionCarouselEnabled && input.currentUserProfile?.ids.id
      ? (
          await listSessionCompletions(input.supabase, {
            orgId: input.orgId,
            profileId: input.currentUserProfile.ids.id,
            limit: 50,
          })
        ).items
      : [];
  const completedSessionsPending = sessionCompletions.filter(
    (completion) =>
      completion.status === 'pending' ||
      ((completion.status === 'confirmed' || completion.status === 'auto_confirmed') &&
        completion.rating == null),
  );

  return {
    activeRole,
    isStaffView,
    metricsByRole: {
      parents: activeRole === 'parents' ? activeRoleData.metrics : cloneZeroMetrics(),
      students: activeRole === 'students' ? activeRoleData.metrics : cloneZeroMetrics(),
      tutors: activeRole === 'tutors' ? activeRoleData.metrics : cloneZeroMetrics(),
    },
    upcomingSessionsPage: activeRoleData.upcomingSessionsPage,
    completedSessionsPending,
    sessionCompletionSummary: input.sessionCompletionCarouselEnabled
      ? {
          completed: sessionCompletions.filter(
            (completion) =>
              completion.status === 'confirmed' || completion.status === 'auto_confirmed',
          ).length,
          pending: sessionCompletions.filter(
            (completion) => completion.status === 'pending',
          ).length,
        }
      : null,
    browseHref: isStaffView ? `/${input.orgSlug}/admin/channels` : `/${input.orgSlug}/s`,
    calendarHref: isStaffView
      ? `/${input.orgSlug}/admin/attendance/sessions`
      : `/${input.orgSlug}/class-schedule`,
    notificationsHref: `/${input.orgSlug}/notifications`,
  };
}
