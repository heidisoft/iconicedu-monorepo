import { useQuery } from '@tanstack/react-query';
import { fetchOrgSessions, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
import { useFamilyLinks } from './use-family-links';
import { useProfile } from './use-profile';
import {
  expandRecurringSchedules,
  type DisplaySchedule,
} from '@/components/messages/space-sessions-tab';
import {
  type ClassSession,
  formatTimeBadge,
  formatOriginalTime,
  formatOriginalDate,
} from '@/components/sessions/session-card';
import type { ParticipantRoleVM } from '@iconicedu/shared-types';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function getParticipantLabel(input: {
  schedule: DisplaySchedule;
  profileKind?: string | null;
}): string | null {
  const items = getRelevantParticipants(input).map((participant) => participant.name);
  return items.length ? items.join(', ') : null;
}

function getRelevantParticipants(input: {
  schedule: DisplaySchedule;
  profileKind?: string | null;
}): { name: string; themeKey?: string | null }[] {
  const targetRoles: Set<ParticipantRoleVM> | null =
    input.profileKind === 'guardian'
      ? new Set<ParticipantRoleVM>(['child', 'educator'])
      : input.profileKind === 'educator'
        ? new Set<ParticipantRoleVM>(['child'])
        : input.profileKind === 'child'
          ? new Set<ParticipantRoleVM>(['educator'])
          : input.profileKind === 'staff' || input.profileKind === 'system'
            ? null
            : null;

  const seen = new Set<string>();
  const participants: { name: string; themeKey?: string | null }[] = [];

  input.schedule.participants.forEach((participant) => {
    if (targetRoles && !targetRoles.has(participant.role)) {
      return;
    }

    const name = participant.displayName?.trim();
    if (!name || seen.has(name)) {
      return;
    }

    seen.add(name);
    participants.push({ name, themeKey: participant.themeKey ?? null });
  });

  return participants;
}

function mapToClassSession(
  s: DisplaySchedule,
  nowMs: number,
  nowDay: number,
  profileKind?: string | null,
): ClassSession {
  const start = new Date(s.startAt);
  const end = new Date(s.endAt);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const startDay = startOfDay(start).getTime();
  return {
    id: s.ids.id,
    label: s.title,
    time: formatTimeBadge(s.startAt),
    participantLabel: getParticipantLabel({ schedule: s, profileKind }),
    participants: getRelevantParticipants({ schedule: s, profileKind }),
    dayName: start.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: String(start.getDate()),
    isToday: startDay === nowDay,
    isLive: startMs <= nowMs && endMs >= nowMs,
    isPast: endMs < nowMs,
    status: s.status,
    meetingLink: s.meetingLink ?? null,
    channelId:
      (s.source?.kind === 'class_session' ? s.source.channelId : undefined) ?? null,
    students: s.participants
      .filter((p) => p.role === 'child' && p.displayName)
      .map((p) => ({ name: p.displayName as string, themeKey: p.themeKey ?? null })),
    variant: s.uiState?.kind ?? 'default',
    disabled: s.uiState?.disabled ?? false,
    reason: s.uiState?.reason ?? null,
    originalTime: s.uiState?.originalStartAt
      ? formatOriginalTime(s.uiState.originalStartAt)
      : null,
    originalDate: s.uiState?.originalStartAt
      ? formatOriginalDate(s.uiState.originalStartAt)
      : null,
    startAt: s.startAt,
    endAt: s.endAt,
  };
}

function getScopedProfileIds(input: {
  profileKind?: string | null;
  profileId?: string | null;
  childProfileIds?: string[];
}): Set<string> {
  if (input.profileKind === 'guardian') {
    return new Set(input.childProfileIds ?? []);
  }

  if (input.profileKind === 'child' || input.profileKind === 'educator') {
    return new Set(input.profileId ? [input.profileId] : []);
  }

  return new Set<string>();
}

function isScopedSchedule(input: {
  schedule: DisplaySchedule;
  profileKind?: string | null;
  scopedProfileIds: Set<string>;
}): boolean {
  if (input.profileKind === 'staff' || input.profileKind === 'system') {
    return input.schedule.source.kind === 'class_session';
  }

  if (!input.scopedProfileIds.size || input.schedule.source.kind !== 'class_session') {
    return false;
  }

  const targetRole: ParticipantRoleVM =
    input.profileKind === 'educator' ? 'educator' : 'child';

  return input.schedule.participants.some(
    (participant) =>
      participant.role === targetRole && input.scopedProfileIds.has(participant.ids.id),
  );
}

export function useUpcomingSessions(): {
  sessions: ClassSession[];
  isPending: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { childProfiles } = useFamilyLinks();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;
  const profileKind = (profile as Record<string, unknown> | undefined)?.kind as
    | string
    | undefined;
  const scopedProfileIds = getScopedProfileIds({
    profileKind,
    profileId,
    childProfileIds: (childProfiles as Record<string, unknown>[]).map(
      (child) => child.id as string,
    ),
  });

  const query = useQuery({
    queryKey: queryKeys.orgSessions(orgId ?? ''),
    queryFn: () => fetchOrgSessions(orgId!),
    enabled: !!orgId && !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  const sessions: ClassSession[] = (() => {
    const raw = query.data ?? [];
    if (!raw.length) return [];

    const now = new Date();
    const nowMs = now.getTime();
    const rangeStart = now;
    const currentWeekStart = startOfWeek(now);
    const nextWeekStart = addDays(currentWeekStart, 7);
    const weekAfterNextStart = addDays(currentWeekStart, 14);
    const rangeEnd = endOfDay(addDays(weekAfterNextStart, -1));

    const expanded = expandRecurringSchedules(raw, rangeStart, rangeEnd);

    return expanded
      .filter((s) => {
        if (!isScopedSchedule({ schedule: s, profileKind, scopedProfileIds })) {
          return false;
        }
        const startAt = new Date(s.startAt).getTime();
        const endAt = new Date(s.endAt).getTime();
        return (
          endAt >= nowMs &&
          startAt <= rangeEnd.getTime() &&
          startAt >= nextWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000
        );
      })
      .map((s) => mapToClassSession(s, nowMs, startOfDay(now).getTime(), profileKind))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  })();

  return {
    sessions,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}

export const __test__ = {
  getScopedProfileIds,
  isScopedSchedule,
};
