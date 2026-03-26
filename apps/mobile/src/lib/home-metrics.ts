import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { expandRecurringSchedules } from '@/components/messages/space-sessions-tab';

type HomeRole = 'guardian' | 'child' | 'educator' | 'staff' | 'system' | 'other';

export type HomeMetricSummary = {
  upcomingSessionsThisWeek: number;
  completedClassesThisMonth: number;
  thirdMetricTitle: 'Active Subjects' | 'Active Students' | 'Manage Classrooms';
  thirdMetricValue: number;
  thirdMetricLabel: string;
};

export type LearningSpaceSummary = {
  id: string;
  status?: string | null;
  subject?: string | null;
  title?: string | null;
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

export function buildHomeMetricSummary(input: {
  schedules: ClassScheduleVM[];
  learningSpaces: LearningSpaceSummary[];
  profileKind?: string | null;
  primaryRole?: string | null;
  profileId?: string | null;
  childProfileIds?: string[];
  now?: Date;
}): HomeMetricSummary {
  const role = resolveHomeRole(input.profileKind ?? input.primaryRole);
  const scopedProfileIds = getScopedProfileIds({
    role,
    profileId: input.profileId,
    childProfileIds: input.childProfileIds,
  });

  const now = input.now ?? new Date();
  const weekStart = startOfWeekMonday(now);
  const weekEnd = endOfWeekSunday(weekStart);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = endOfMonth(now);

  const expandedSchedules = expandRecurringSchedules(
    input.schedules,
    monthStart,
    weekEnd,
  );
  const scopedSchedules = expandedSchedules.filter((schedule) =>
    isScopedSchedule(schedule, role, scopedProfileIds),
  );

  const upcomingSessionsThisWeek = scopedSchedules.filter((schedule) => {
    if (schedule.status === 'cancelled') return false;
    const startAt = new Date(schedule.startAt).getTime();
    const endAt = new Date(schedule.endAt).getTime();
    return (
      endAt >= now.getTime() &&
      startAt >= weekStart.getTime() &&
      startAt <= weekEnd.getTime()
    );
  }).length;

  const completedClassesThisMonth = scopedSchedules.filter((schedule) => {
    if (schedule.status === 'cancelled') return false;
    if (schedule.uiState?.kind === 'exception') return false;
    const endAt = new Date(schedule.endAt).getTime();
    return (
      endAt < now.getTime() &&
      endAt >= monthStart.getTime() &&
      endAt <= monthEnd.getTime()
    );
  }).length;

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
