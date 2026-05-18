import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { expandRecurringSchedules } from '@/components/messages/space-sessions-tab';
import {
  formatOriginalDate,
  formatOriginalTime,
  formatTimeBadge,
  type ClassSession,
} from '@/components/sessions/session-card';
import type { ParticipantRoleVM } from '@iconicedu/shared-types';

type HomeRole = 'guardian' | 'child' | 'educator' | 'staff' | 'system' | 'other';

export type HomeMetricSummary = {
  upcomingSessionsThisWeek: number;
  completedClassesThisMonth: number;
  thirdMetricTitle: 'Active Subjects' | 'Active Students' | 'Manage Classrooms';
  thirdMetricValue: number;
  thirdMetricLabel: string;
};

export type HomeUpcomingSessionsMetricDisplay = {
  value: number;
  label: 'This week' | 'Next week';
};

export type LearningSpaceSummary = {
  id: string;
  status?: string | null;
  subject?: string | null;
  title?: string | null;
};

export type HomeSessionBuckets = {
  today: ClassSession[];
  thisWeek: ClassSession[];
  nextWeek: ClassSession[];
};

type ScopedDisplaySchedule = ClassScheduleVM & {
  uiState?: {
    kind?: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeekMonday(date: Date): Date {
  const day = startOfDay(date);
  const weekday = day.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return new Date(day.getTime() + diff * 86_400_000);
}

function endOfWeekSunday(date: Date): Date {
  return new Date(date.getTime() + 6 * 86_400_000 + 86_399_999);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function normalizeTimezone(timezone?: string | null): string | null {
  const value = timezone?.trim();
  if (!value) {
    return null;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return null;
  }
}

function getScheduleDisplayTimezone(
  schedule: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>,
  viewerTimezone?: string | null,
): string {
  return (
    normalizeTimezone(viewerTimezone) ??
    normalizeTimezone(schedule.timezone ?? schedule.recurrence?.rule.timezone ?? null) ??
    'UTC'
  );
}

function getDisplayDateParts(
  input: Date | string,
  timezone: string,
): {
  year: number;
  month: number;
  day: number;
} | null {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);

  const year = lookup('year');
  const month = lookup('month');
  const day = lookup('day');

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function getScheduleDisplayStartOfDay(input: Date | string, timezone: string): Date {
  const parts = getDisplayDateParts(input, timezone);
  if (!parts) {
    return startOfDay(input instanceof Date ? input : new Date(input));
  }

  return new Date(parts.year, parts.month - 1, parts.day);
}

function getScheduleDisplayStartOfWeek(input: Date | string, timezone: string): Date {
  return startOfWeekMonday(getScheduleDisplayStartOfDay(input, timezone));
}

function getResolvedScheduleDisplayMonthKey(
  input: Date | string,
  timezone: string,
): string {
  const parts = getDisplayDateParts(input, timezone);
  if (!parts) {
    return '1970-01';
  }

  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function getParticipantLabel(input: {
  schedule: ScopedDisplaySchedule;
  profileKind?: string | null;
}): string | null {
  const items = getRelevantParticipants(input).map((participant) => participant.name);
  return items.length ? items.join(', ') : null;
}

function getRelevantParticipants(input: {
  schedule: ScopedDisplaySchedule;
  profileKind?: string | null;
}): Array<{
  name: string;
  kind: Extract<ParticipantRoleVM, 'educator' | 'guardian' | 'child' | 'staff'>;
  themeKey?: string | null;
}> {
  const targetRoles: Set<ParticipantRoleVM> | null =
    input.profileKind === 'guardian'
      ? new Set<ParticipantRoleVM>(['child', 'educator'])
      : input.profileKind === 'educator'
        ? new Set<ParticipantRoleVM>(['child', 'educator'])
        : input.profileKind === 'child'
          ? new Set<ParticipantRoleVM>(['child', 'educator'])
          : input.profileKind === 'staff' || input.profileKind === 'system'
            ? null
            : null;

  const seen = new Set<string>();
  const participants: Array<{
    name: string;
    kind: Extract<ParticipantRoleVM, 'educator' | 'guardian' | 'child' | 'staff'>;
    themeKey?: string | null;
  }> = [];

  input.schedule.participants.forEach((participant) => {
    if (targetRoles && !targetRoles.has(participant.role)) {
      return;
    }

    const name = participant.displayName?.trim();
    if (!name || seen.has(name)) {
      return;
    }

    if (
      participant.role !== 'educator' &&
      participant.role !== 'guardian' &&
      participant.role !== 'child' &&
      participant.role !== 'staff'
    ) {
      return;
    }

    seen.add(name);
    participants.push({
      name,
      kind: participant.role,
      themeKey: participant.themeKey ?? null,
    });
  });

  return participants;
}

function resolveHomeRole(kind?: string | null): HomeRole {
  if (kind === 'guardian') return 'guardian';
  if (kind === 'child') return 'child';
  if (kind === 'educator') return 'educator';
  if (kind === 'staff') return 'staff';
  if (kind === 'system') return 'system';
  return 'other';
}

function getScopedProfileIds(input: {
  role: HomeRole;
  profileId?: string | null;
  childProfileIds?: string[];
}): Set<string> {
  if (input.role === 'guardian') {
    return new Set(input.childProfileIds ?? []);
  }

  if (input.role === 'child' || input.role === 'educator') {
    return new Set(input.profileId ? [input.profileId] : []);
  }

  return new Set<string>();
}

function isScopedSchedule(
  schedule: ClassScheduleVM,
  role: HomeRole,
  scopedProfileIds: Set<string>,
): boolean {
  if (role === 'staff' || role === 'system') {
    return schedule.source.kind === 'class_session';
  }

  if (!scopedProfileIds.size || schedule.source.kind !== 'class_session') {
    return false;
  }

  const participantRole = role === 'educator' ? 'educator' : 'child';

  return schedule.participants.some(
    (participant) =>
      participant.role === participantRole && scopedProfileIds.has(participant.ids.id),
  );
}

function getLearningSpaceId(schedule: ClassScheduleVM): string | null {
  if (schedule.source.kind !== 'class_session') {
    return null;
  }

  return 'learningSpaceId' in schedule.source ? schedule.source.learningSpaceId : null;
}

function toActiveStudentsLabel(count: number): string {
  if (!count) return 'No active students yet';
  return count === 1 ? '1 active student' : `${count} active students`;
}

function toActiveSubjectsLabel(subjects: string[]): string {
  if (!subjects.length) return 'No active subjects yet';
  if (subjects.length <= 3) return subjects.join(', ');
  return `${subjects.slice(0, 3).join(', ')} +${subjects.length - 3} more`;
}

export function splitHomeSessionsByTimeline(input: {
  sessions: ClassSession[];
  now?: Date;
  timezone?: string | null;
}): HomeSessionBuckets {
  const now = input.now ?? new Date();
  const viewerTimezone = normalizeTimezone(input.timezone) ?? 'UTC';
  const thisWeekStart = getScheduleDisplayStartOfWeek(now, viewerTimezone).getTime();
  const nextWeekStart = new Date(thisWeekStart + 7 * 86_400_000).getTime();
  const weekAfterNextStart = new Date(nextWeekStart + 7 * 86_400_000).getTime();

  return input.sessions.reduce<HomeSessionBuckets>(
    (buckets, session) => {
      const startAt = getScheduleDisplayStartOfDay(
        session.startAt,
        viewerTimezone,
      ).getTime();
      const isToday =
        getScheduleDisplayStartOfDay(session.startAt, viewerTimezone).getTime() ===
        getScheduleDisplayStartOfDay(now, viewerTimezone).getTime();

      if (isToday) {
        buckets.today.push(session);
        return buckets;
      }

      if (startAt >= thisWeekStart && startAt < nextWeekStart) {
        buckets.thisWeek.push(session);
        return buckets;
      }

      if (startAt >= nextWeekStart && startAt < weekAfterNextStart) {
        buckets.nextWeek.push(session);
      }

      return buckets;
    },
    { today: [], thisWeek: [], nextWeek: [] },
  );
}

export function buildHomeUpcomingSessionsMetricDisplay(input: {
  upcomingSessionsThisWeek: number;
  nextWeekSessions: Array<Pick<ClassSession, 'status'>>;
}): HomeUpcomingSessionsMetricDisplay {
  if (input.upcomingSessionsThisWeek > 0) {
    return {
      value: input.upcomingSessionsThisWeek,
      label: 'This week',
    };
  }

  return {
    value: input.nextWeekSessions.filter((session) => session.status !== 'cancelled')
      .length,
    label: 'Next week',
  };
}

function buildHomeScopedSchedules(input: {
  schedules: ClassScheduleVM[];
  profileKind?: string | null;
  primaryRole?: string | null;
  profileId?: string | null;
  childProfileIds?: string[];
  now?: Date;
  timezone?: string | null;
}): {
  role: HomeRole;
  scopedSchedules: ScopedDisplaySchedule[];
  upcomingSessionsPage: HomeSessionBuckets;
  completedClassesThisMonth: number;
} {
  const role = resolveHomeRole(input.profileKind ?? input.primaryRole);
  const scopedProfileIds = getScopedProfileIds({
    role,
    profileId: input.profileId,
    childProfileIds: input.childProfileIds,
  });
  const now = input.now ?? new Date();
  const viewerTimezone = normalizeTimezone(input.timezone) ?? 'UTC';
  const weekStartDate = getScheduleDisplayStartOfWeek(now, viewerTimezone);
  const weekStartMs = weekStartDate.getTime();
  const nextWeekEndMs = (() => {
    const nextWeekEnd = endOfWeekSunday(weekStartDate);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    return nextWeekEnd.getTime();
  })();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeStart = monthStart < now ? monthStart : now;
  const rangeEnd = new Date(Math.max(endOfMonth(now).getTime(), nextWeekEndMs));

  const expandedSchedules = expandRecurringSchedules(
    input.schedules,
    rangeStart,
    rangeEnd,
  ) as ScopedDisplaySchedule[];
  const scopedSchedules = expandedSchedules.filter((schedule) =>
    isScopedSchedule(schedule, role, scopedProfileIds),
  );

  const upcomingSchedules = scopedSchedules
    .filter((schedule) => new Date(schedule.endAt).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const upcomingThisAndNextWeek = upcomingSchedules.filter((schedule) => {
    const scheduleDayMs = getScheduleDisplayStartOfDay(
      schedule.startAt,
      getScheduleDisplayTimezone(schedule, viewerTimezone),
    ).getTime();
    return scheduleDayMs >= weekStartMs && scheduleDayMs <= nextWeekEndMs;
  });

  const currentMonthKey = getResolvedScheduleDisplayMonthKey(now, viewerTimezone);
  const completedClassesThisMonth = scopedSchedules.reduce((count, schedule) => {
    const monthKey = getResolvedScheduleDisplayMonthKey(
      schedule.startAt,
      getScheduleDisplayTimezone(schedule, viewerTimezone),
    );
    if (monthKey !== currentMonthKey) {
      return count;
    }
    if (schedule.status === 'cancelled') {
      return count;
    }
    if (
      schedule.status === 'completed' ||
      new Date(schedule.endAt).getTime() < now.getTime()
    ) {
      return count + 1;
    }
    return count;
  }, 0);

  const currentWeekStart = getScheduleDisplayStartOfWeek(now, viewerTimezone).getTime();
  const todayStart = getScheduleDisplayStartOfDay(now, viewerTimezone).getTime();

  const sessions = upcomingThisAndNextWeek.map((schedule) => {
    const scheduleTimezone = getScheduleDisplayTimezone(schedule, viewerTimezone);
    const startDisplayDate = getScheduleDisplayStartOfDay(
      schedule.startAt,
      scheduleTimezone,
    );
    const startMs = new Date(schedule.startAt).getTime();
    const endMs = new Date(schedule.endAt).getTime();

    return {
      id: schedule.ids.id,
      label: schedule.title,
      time: formatTimeBadge(schedule.startAt),
      participantLabel: getParticipantLabel({ schedule, profileKind: input.profileKind }),
      participants: getRelevantParticipants({ schedule, profileKind: input.profileKind }),
      dayName: startDisplayDate.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: String(startDisplayDate.getDate()),
      isToday: startDisplayDate.getTime() === todayStart,
      isLive:
        schedule.status !== 'cancelled' &&
        startMs <= now.getTime() &&
        now.getTime() <= endMs,
      isPast: endMs < now.getTime(),
      status: schedule.status,
      meetingLink: schedule.meetingLink ?? null,
      channelId:
        schedule.source.kind === 'class_session'
          ? (schedule.source.channelId ?? null)
          : null,
      students: schedule.participants
        .filter((participant) => participant.role === 'child' && participant.displayName)
        .map((participant) => ({
          name: participant.displayName as string,
          themeKey: participant.themeKey ?? null,
        })),
      variant: schedule.uiState?.kind ?? 'default',
      disabled: schedule.uiState?.disabled ?? false,
      reason: schedule.uiState?.reason ?? null,
      originalTime: schedule.uiState?.originalStartAt
        ? formatOriginalTime(schedule.uiState.originalStartAt)
        : null,
      originalDate: schedule.uiState?.originalStartAt
        ? formatOriginalDate(schedule.uiState.originalStartAt)
        : null,
      startAt: schedule.startAt,
      endAt: schedule.endAt,
    } satisfies ClassSession;
  });

  const upcomingSessionsPage = sessions.reduce<HomeSessionBuckets>(
    (buckets, session) => {
      const sessionWeekStart = getScheduleDisplayStartOfWeek(
        session.startAt,
        viewerTimezone,
      ).getTime();

      if (session.isToday) {
        buckets.today.push(session);
      } else if (sessionWeekStart === currentWeekStart) {
        buckets.thisWeek.push(session);
      } else {
        buckets.nextWeek.push(session);
      }

      return buckets;
    },
    { today: [], thisWeek: [], nextWeek: [] },
  );

  return {
    role,
    scopedSchedules,
    upcomingSessionsPage,
    completedClassesThisMonth,
  };
}

export function buildHomeUpcomingSessions(input: {
  schedules: ClassScheduleVM[];
  profileKind?: string | null;
  primaryRole?: string | null;
  profileId?: string | null;
  childProfileIds?: string[];
  now?: Date;
  timezone?: string | null;
}): ClassSession[] {
  const { upcomingSessionsPage } = buildHomeScopedSchedules(input);

  return [
    ...upcomingSessionsPage.today,
    ...upcomingSessionsPage.thisWeek,
    ...upcomingSessionsPage.nextWeek,
  ];
}

export function buildHomeMetricSummary(input: {
  schedules: ClassScheduleVM[];
  learningSpaces: LearningSpaceSummary[];
  profileKind?: string | null;
  primaryRole?: string | null;
  profileId?: string | null;
  childProfileIds?: string[];
  now?: Date;
  timezone?: string | null;
}): HomeMetricSummary {
  const { role, scopedSchedules, upcomingSessionsPage, completedClassesThisMonth } =
    buildHomeScopedSchedules(input);

  const upcomingSessionsThisWeek = [
    ...upcomingSessionsPage.today,
    ...upcomingSessionsPage.thisWeek,
  ].filter((session) => session.status !== 'cancelled').length;

  const activeLearningSpaces = input.learningSpaces.filter(
    (space) => space.status === 'active',
  );
  const activeLearningSpaceIds = new Set(activeLearningSpaces.map((space) => space.id));

  if (role === 'staff' || role === 'system') {
    return {
      upcomingSessionsThisWeek,
      completedClassesThisMonth,
      thirdMetricTitle: 'Manage Classrooms',
      thirdMetricValue: activeLearningSpaces.length,
      thirdMetricLabel: 'Manage classrooms',
    };
  }

  if (role === 'educator') {
    const activeStudentIds = new Set<string>();

    scopedSchedules.forEach((schedule) => {
      const learningSpaceId = getLearningSpaceId(schedule);
      if (!learningSpaceId || !activeLearningSpaceIds.has(learningSpaceId)) return;

      schedule.participants.forEach((participant) => {
        if (participant.role === 'child') {
          activeStudentIds.add(participant.ids.id);
        }
      });
    });

    return {
      upcomingSessionsThisWeek,
      completedClassesThisMonth,
      thirdMetricTitle: 'Active Students',
      thirdMetricValue: activeStudentIds.size,
      thirdMetricLabel: toActiveStudentsLabel(activeStudentIds.size),
    };
  }

  const activeSubjects = Array.from(
    new Set(
      scopedSchedules.flatMap((schedule) => {
        const learningSpaceId = getLearningSpaceId(schedule);
        if (!learningSpaceId) {
          return [];
        }

        if (!activeLearningSpaceIds.has(learningSpaceId)) {
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

  return {
    upcomingSessionsThisWeek,
    completedClassesThisMonth,
    thirdMetricTitle: 'Active Subjects',
    thirdMetricValue: activeSubjects.length,
    thirdMetricLabel: toActiveSubjectsLabel(activeSubjects),
  };
}
