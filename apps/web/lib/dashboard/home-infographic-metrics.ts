import type { ClassScheduleVM, UserProfileVM } from '@iconicedu/shared-types';
import {
  getResolvedScheduleDisplayMonthKey,
  getScheduleDisplayStartOfDay,
  getScheduleDisplayStartOfWeek,
  getMonthProgressStatsByKey,
  groupSchedulesByMonth,
  splitSchedulesByTimeline,
  toMonthGroups,
  type ClassSession,
} from '@iconicedu/ui-web/components/messages/tabs/messages-schedule-tab.utils';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import { getLearningSpacesByOrg } from '@iconicedu/web/lib/spaces/queries/learning-spaces.query';
import { getLearningSpaceParticipantsByLearningSpaceIds } from '@iconicedu/web/lib/spaces/queries/learning-space-relations.query';
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
        today: {
          items: [],
          total: 0,
          pageSize: input.pageSize,
          totalPages: 1,
        },
        thisWeek: {
          items: [],
          total: 0,
          pageSize: input.pageSize,
          totalPages: 1,
        },
        nextWeek: {
          items: [],
          total: 0,
          pageSize: input.pageSize,
          totalPages: 1,
        },
      },
    };
  }

  const [schedules, learningSpaceResponse] = await Promise.all([
    buildClassSchedulesByOrg(input.supabase, input.orgId),
    getLearningSpacesByOrg(input.supabase, input.orgId),
  ]);

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
        today: {
          items: [],
          total: 0,
          pageSize: input.pageSize,
          totalPages: 1,
        },
        thisWeek: {
          items: [],
          total: 0,
          pageSize: input.pageSize,
          totalPages: 1,
        },
        nextWeek: {
          items: [],
          total: 0,
          pageSize: input.pageSize,
          totalPages: 1,
        },
      },
    };
  }

  const timelineBuckets = splitSchedulesByTimeline(scopedSchedules, input.now);
  const displayNow = getScheduleDisplayStartOfDay(input.now, input.timezone ?? null);
  const weekStartDate = getScheduleDisplayStartOfWeek(displayNow, input.timezone ?? null);
  const weekStartMs = weekStartDate.getTime();
  const weekEndMs = endOfWeekSunday(weekStartDate).getTime();
  const nextWeekEndMs = (() => {
    const nextWeekEnd = endOfWeekSunday(weekStartDate);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    return nextWeekEnd.getTime();
  })();
  const upcomingSchedulesThisAndNextWeek = timelineBuckets.upcoming.filter((schedule) => {
    const scheduleDayMs = getScheduleDisplayStartOfDay(
      schedule.startAt,
      input.timezone ?? null,
    ).getTime();
    return scheduleDayMs >= weekStartMs && scheduleDayMs <= nextWeekEndMs;
  });
  const upcomingSessionsThisWeek = timelineBuckets.upcoming.filter((schedule) => {
    const scheduleDayMs = getScheduleDisplayStartOfDay(
      schedule.startAt,
      input.timezone ?? null,
    ).getTime();
    return scheduleDayMs >= weekStartMs && scheduleDayMs <= weekEndMs;
  }).length;

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

  const learningSpaces = learningSpaceResponse.data ?? [];
  const activeLearningSpaces = learningSpaces.filter(
    (space) => space.status === 'active',
  );
  const learningSpaceIds = activeLearningSpaces.map((space) => space.id);

  const activeSubjects = input.isStaffView
    ? activeLearningSpaces
        .map((space) => space.title?.trim())
        .filter((title): title is string => Boolean(title))
    : await (async () => {
        const participantsResponse = await getLearningSpaceParticipantsByLearningSpaceIds(
          input.supabase,
          input.orgId,
          learningSpaceIds,
        );

        const participantSpaceIds = new Set(
          (participantsResponse.data ?? [])
            .filter((row) => input.scopedProfileIds.has(row.profile_id))
            .map((row) => row.learning_space_id),
        );

        return Array.from(
          new Set(
            activeLearningSpaces
              .filter((space) => participantSpaceIds.has(space.id))
              .map((space) => space.subject?.trim())
              .filter((subject): subject is string => Boolean(subject)),
          ),
        );
      })();

  const activeStudentsCount =
    input.activeRole === 'tutors'
      ? (() => {
          const activeLearningSpaceIdSet = new Set(learningSpaceIds);
          const activeStudentIds = new Set<string>();

          scopedSchedules.forEach((schedule) => {
            if (schedule.source.kind !== 'class_session') {
              return;
            }
            if (!activeLearningSpaceIdSet.has(schedule.source.learningSpaceId)) {
              return;
            }

            schedule.participants.forEach((participant) => {
              if (participant.role === 'child') {
                activeStudentIds.add(participant.ids.id);
              }
            });
          });

          return activeStudentIds.size;
        })()
      : 0;

  return {
    metrics: {
      upcomingSessionsThisWeek,
      completedClassesThisMonth,
      activeSubjectsCount:
        input.activeRole === 'tutors' ? activeStudentsCount : activeSubjects.length,
      activeSubjectsLabel: input.isStaffView
        ? 'Manage classrooms'
        : input.activeRole === 'tutors'
          ? toActiveStudentsLabel(activeStudentsCount)
          : toActiveSubjectsLabel(activeSubjects),
    },
    upcomingSessionsPage: buildUpcomingSessionPage({
      upcomingSchedules: upcomingSchedulesThisAndNextWeek,
      orgSlug: input.orgSlug,
      pageSize: input.pageSize,
      now: input.now,
      activeRole: input.activeRole,
      isStaffView: input.isStaffView,
      timezone: input.timezone,
    }),
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

  return {
    activeRole,
    isStaffView,
    metricsByRole: {
      parents: activeRole === 'parents' ? activeRoleData.metrics : cloneZeroMetrics(),
      students: activeRole === 'students' ? activeRoleData.metrics : cloneZeroMetrics(),
      tutors: activeRole === 'tutors' ? activeRoleData.metrics : cloneZeroMetrics(),
    },
    upcomingSessionsPage: activeRoleData.upcomingSessionsPage,
    browseHref: isStaffView ? `/${input.orgSlug}/admin/channels` : `/${input.orgSlug}/s`,
    calendarHref: isStaffView
      ? `/${input.orgSlug}/admin/attendance/sessions`
      : `/${input.orgSlug}/class-schedule`,
    notificationsHref: `/${input.orgSlug}/notifications`,
  };
}
