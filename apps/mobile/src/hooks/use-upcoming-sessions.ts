import { useQuery } from '@tanstack/react-query';
import { fetchOrgSessions, queryKeys } from '@/lib/api/queries';
import { useAccount } from './use-account';
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

export function useUpcomingSessions(): {
  sessions: ClassSession[];
  isPending: boolean;
  refetch: () => Promise<unknown>;
} {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;
  const profileKind = (profile as Record<string, unknown> | undefined)?.kind as
    | string
    | undefined;

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
    const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expanded = expandRecurringSchedules(raw, rangeStart, rangeEnd);

    return expanded
      .filter((s) => {
        const startAt = new Date(s.startAt).getTime();
        const endAt = new Date(s.endAt).getTime();
        return endAt >= nowMs && startAt <= rangeEnd.getTime();
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
