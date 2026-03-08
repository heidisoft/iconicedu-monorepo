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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mapToClassSession(
  s: DisplaySchedule,
  nowMs: number,
  nowDay: number,
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
    const todayStart = startOfDay(now);
    // End of the current week (Sunday 23:59:59)
    const daysUntilEndOfWeek = 6 - todayStart.getDay();
    const weekEnd = new Date(
      todayStart.getTime() + (daysUntilEndOfWeek + 1) * 24 * 60 * 60 * 1000 - 1,
    );

    const expanded = expandRecurringSchedules(raw, todayStart, weekEnd);

    return expanded
      .filter((s) => s.status !== 'cancelled' && new Date(s.endAt).getTime() >= nowMs)
      .map((s) => mapToClassSession(s, nowMs, startOfDay(now).getTime()))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  })();

  return {
    sessions,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}
