import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, CheckCircle2, X } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type {
  ArchiveAwareClassScheduleVM,
  ClassScheduleVM,
  SessionChangeRequestVM,
} from '@iconicedu/shared-types';
import { applyArchiveCutoffToDisplaySchedules } from '@iconicedu/shared-types';
import {
  approveSessionChangeRequest,
  fetchSelfServeRescheduleOptions,
  fetchSessionChangeRequests,
  queryKeys,
  rejectSessionChangeRequest,
  selfServeCancelSession,
  selfServeRescheduleSession,
  selfServeUndoCancelSession,
} from '@/lib/api/queries';
import {
  ClassSession,
  SessionCard,
  formatTimeBadge,
  formatOriginalTime,
  formatOriginalDate,
} from '@/components/sessions/session-card';
import { RescheduleAvailabilityPicker } from '@/components/sessions/reschedule-availability-picker';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SessionSubTab = 'upcoming' | 'past';

type MonthGroup = {
  monthKey: string;
  month: string;
  year: string;
  totalCount: number;
  completedCount: number;
  isCurrentMonth: boolean;
  sessions: ClassSession[];
};

type MonthProgressStats = {
  scheduledCount: number;
  completedCount: number;
};

export type DisplaySchedule = ArchiveAwareClassScheduleVM;

type ChangeModalState =
  | { kind: 'cancel'; session: ClassSession; note: string }
  | {
      kind: 'reschedule';
      session: ClassSession;
      date: string;
      startTime: string;
      endTime: string;
      startAtIso?: string | null;
      endAtIso?: string | null;
      timezone?: string | null;
      note: string;
    }
  | null;

// ─── Recurring expansion helpers ───────────────────────────────────────────────

const weekdayTokens: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function occurrenceDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function occurrenceIdentity(schedule: DisplaySchedule): string {
  const baseId = schedule.ids.id.includes('__')
    ? schedule.ids.id.slice(0, schedule.ids.id.indexOf('__'))
    : schedule.ids.id;

  if (schedule.uiState?.originalStartAt) {
    return `${baseId}|${schedule.uiState.originalStartAt}`;
  }

  if (schedule.ids.id.includes('__')) {
    const [, occurrenceKey = schedule.startAt] = schedule.ids.id.split('__');
    return `${baseId}|${occurrenceKey}`;
  }

  return `${baseId}|${schedule.startAt}`;
}

function getBaseScheduleId(scheduleId: string): string {
  return scheduleId.includes('__')
    ? scheduleId.slice(0, scheduleId.indexOf('__'))
    : scheduleId;
}

function getOccurrenceKey(schedule: DisplaySchedule): string | null {
  if (schedule.uiState?.originalStartAt) return schedule.uiState.originalStartAt;
  if (!schedule.ids.id.includes('__')) return null;
  return schedule.ids.id.split('__')[1] || null;
}

function formatDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function formatTimeInput(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineLocalDateTime(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (!year || !month || !day || hour == null || minute == null) {
    throw new Error('Enter a valid date and time.');
  }
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function formatRequestWindow(request: SessionChangeRequestVM): string {
  const current = new Date(request.currentStartAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (request.type === 'cancel') return `Cancel ${current}`;
  const next = request.requestedStartAt
    ? new Date(request.requestedStartAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'new time';
  return `${current} → ${next}`;
}

function getCalendarWeekOfMonth(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekdayOffset = firstDayOfMonth.getDay();
  return Math.floor((date.getDate() + firstWeekdayOffset - 1) / 7) + 1;
}

export function expandRecurringSchedules(
  schedules: ClassScheduleVM[],
  rangeStart: Date,
  rangeEnd: Date,
): DisplaySchedule[] {
  const expanded: DisplaySchedule[] = [];
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  for (const event of schedules) {
    if (!event.recurrence) {
      const eventDay = startOfDay(new Date(event.startAt));
      if (eventDay >= rangeStartDay && eventDay <= rangeEndDay) {
        expanded.push({ ...event, uiState: { kind: 'default' } });
      }
      continue;
    }

    const recurrence = event.recurrence;
    const rule = recurrence.rule;
    const interval = rule.interval ?? 1;
    const baseStart = new Date(event.startAt);
    const baseDate = startOfDay(baseStart);
    const durationMs = new Date(event.endAt).getTime() - baseStart.getTime();

    const exceptions = new Set(recurrence.exceptions?.map((e) => e.occurrenceKey) ?? []);
    const exceptionsByDay = new Set(
      recurrence.exceptions?.map((e) => occurrenceDayKey(e.occurrenceKey)) ?? [],
    );
    const overrides = new Map(
      recurrence.overrides?.map((o) => [o.occurrenceKey, o.patch]) ?? [],
    );
    const overridesByDay = new Map(
      recurrence.overrides?.map((o) => [occurrenceDayKey(o.occurrenceKey), o.patch]) ??
        [],
    );

    const byWeekday = rule.byWeekday?.length
      ? rule.byWeekday
      : [weekdayTokens[baseDate.getDay()]!];

    // Add exception (skipped) occurrences
    for (const exc of recurrence.exceptions ?? []) {
      const excDayKey = occurrenceDayKey(exc.occurrenceKey);
      if (overrides.has(exc.occurrenceKey) || overridesByDay.has(excDayKey)) continue;
      const originalStart = new Date(exc.occurrenceKey);
      const originalEnd = new Date(originalStart.getTime() + durationMs);
      expanded.push({
        ...event,
        ids: { ...event.ids, id: `${event.ids.id}__${exc.occurrenceKey}__exception` },
        startAt: originalStart.toISOString(),
        endAt: originalEnd.toISOString(),
        status: 'cancelled',
        meetingLink: null,
        recurrence: undefined,
        uiState: {
          kind: 'exception',
          disabled: true,
          reason: exc.reason ?? null,
          cancelledByProfileId: exc.createdBy ?? exc.updatedBy ?? null,
          originalStartAt: originalStart.toISOString(),
          originalEndAt: originalEnd.toISOString(),
        },
      });
    }

    const until = rule.until ? startOfDay(new Date(rule.until)) : null;
    let occurrenceCount = 0;

    for (
      let current = new Date(baseDate);
      current <= rangeEndDay;
      current = addDays(current, 1)
    ) {
      if (current < rangeStartDay) continue;
      if (until && current > until) break;

      const diffDays = (current.getTime() - baseDate.getTime()) / 86400000;
      let matches = false;
      if (rule.frequency === 'daily') {
        matches = diffDays % interval === 0;
      } else if (rule.frequency === 'weekly') {
        const weeksDiff = Math.floor(diffDays / 7);
        matches =
          weeksDiff % interval === 0 &&
          byWeekday.includes(weekdayTokens[current.getDay()]!);
      }

      const occurrenceStart = new Date(current);
      occurrenceStart.setHours(
        baseStart.getHours(),
        baseStart.getMinutes(),
        baseStart.getSeconds(),
        baseStart.getMilliseconds(),
      );
      const occurrenceKey = occurrenceStart.toISOString();
      const occDayKey = occurrenceDayKey(occurrenceKey);
      const override = overrides.get(occurrenceKey) ?? overridesByDay.get(occDayKey);
      const hasOverride = Boolean(override);

      if (!matches && !hasOverride) continue;
      if (
        (exceptions.has(occurrenceKey) || exceptionsByDay.has(occDayKey)) &&
        !hasOverride
      )
        continue;
      if (rule.count && occurrenceCount >= rule.count) break;

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const effectiveStart = override?.startAt
        ? new Date(override.startAt)
        : occurrenceStart;
      const effectiveEnd = override?.endAt ? new Date(override.endAt) : occurrenceEnd;

      expanded.push({
        ...event,
        ...override,
        ids: { ...event.ids, id: `${event.ids.id}__${occurrenceKey}` },
        startAt: effectiveStart.toISOString(),
        endAt: effectiveEnd.toISOString(),
        status: override?.status ?? (hasOverride ? 'rescheduled' : event.status),
        recurrence: undefined,
        uiState: override
          ? {
              kind: 'override',
              originalStartAt: occurrenceKey,
              originalEndAt: occurrenceEnd.toISOString(),
            }
          : {
              kind: 'default',
              originalStartAt: occurrenceKey,
              originalEndAt: occurrenceEnd.toISOString(),
            },
      });

      occurrenceCount++;
    }
  }

  // Deduplicate: higher priority wins per base-id + day
  const deduped = new Map<string, DisplaySchedule>();
  for (const s of expanded) {
    const key = occurrenceIdentity(s);
    const existing = deduped.get(key);
    const priority = (ds: DisplaySchedule) =>
      ds.uiState?.kind === 'exception' ? 3 : ds.uiState?.kind === 'override' ? 2 : 1;
    if (!existing || priority(s) > priority(existing)) {
      deduped.set(key, s);
    }
  }

  return applyArchiveCutoffToDisplaySchedules(Array.from(deduped.values()));
}

// ─── Split + group ──────────────────────────────────────────────────────────────

function splitAndGroupSessions(schedules: ClassScheduleVM[]): {
  upcoming: MonthGroup[];
  past: MonthGroup[];
  monthProgressStatsByKey: Map<string, MonthProgressStats>;
} {
  const now = new Date();
  const nowMs = now.getTime();
  const nowDay = startOfDay(now).getTime();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const rangeEnd = new Date(now.getFullYear() + 2, now.getMonth(), 0);

  const expanded = expandRecurringSchedules(schedules, rangeStart, rangeEnd);

  const upcoming: DisplaySchedule[] = [];
  const past: DisplaySchedule[] = [];

  for (const s of expanded) {
    // A session is "upcoming" (not past) if it hasn't ended yet — mirrors web isEventLive
    if (new Date(s.endAt).getTime() >= nowMs) upcoming.push(s);
    else past.push(s);
  }

  upcoming.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const monthProgressStatsByKey = new Map<string, MonthProgressStats>();
  for (const schedule of expanded) {
    const date = new Date(schedule.startAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthProgressStatsByKey.get(monthKey) ?? {
      scheduledCount: 0,
      completedCount: 0,
    };

    if (schedule.status !== 'cancelled') {
      current.scheduledCount += 1;
    }

    if (
      schedule.status === 'completed' ||
      (schedule.status !== 'cancelled' && new Date(schedule.endAt).getTime() < nowMs)
    ) {
      current.completedCount += 1;
    }

    monthProgressStatsByKey.set(monthKey, current);
  }

  function groupByMonth(displaySchedules: DisplaySchedule[]): MonthGroup[] {
    const map = new Map<string, DisplaySchedule[]>();
    for (const s of displaySchedules) {
      const d = new Date(s.startAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].map(([key, list]) => {
      const [y, m] = key.split('-').map(Number);
      const monthDate = new Date(y!, m! - 1, 1);
      const sessionCountByWeekNumber = new Map<number, number>();
      const sessions: ClassSession[] = list.map((s) => {
        const start = new Date(s.startAt);
        const end = new Date(s.endAt);
        const startMs = start.getTime();
        const endMs = end.getTime();
        const startDay = startOfDay(start).getTime();
        const weekNumber = getCalendarWeekOfMonth(start);
        const nextSessionNumber = (sessionCountByWeekNumber.get(weekNumber) ?? 0) + 1;
        sessionCountByWeekNumber.set(weekNumber, nextSessionNumber);
        const monthLabel = start.toLocaleDateString('en-US', { month: 'short' });
        // Mirrors web isEventLive: now >= startAt && now <= endAt (cancelled sessions are never live)
        const isLive = s.status !== 'cancelled' && startMs <= nowMs && endMs >= nowMs;
        const isPast = endMs < nowMs;
        return {
          id: s.ids.id,
          scheduleId: getBaseScheduleId(s.ids.id),
          occurrenceKey: getOccurrenceKey(s),
          label: `${monthLabel} · Week ${weekNumber} · Session ${nextSessionNumber}`,
          time: formatTimeBadge(s.startAt),
          dayName: start.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: String(start.getDate()),
          isToday: startDay === nowDay,
          isLive,
          isPast,
          status: s.status,
          meetingLink: s.meetingLink ?? null,
          channelId:
            s.source.kind === 'class_session' ? (s.source.channelId ?? null) : null,
          variant: s.uiState?.kind ?? 'default',
          disabled: s.uiState?.disabled ?? false,
          reason: s.uiState?.reason ?? null,
          cancelledByProfileId:
            s.uiState?.cancelledByProfileId ??
            (s.status === 'cancelled' ? (s.audit?.updatedBy ?? null) : null),
          originalTime: s.uiState?.originalStartAt
            ? formatOriginalTime(s.uiState.originalStartAt)
            : null,
          originalDate: s.uiState?.originalStartAt
            ? formatOriginalDate(s.uiState.originalStartAt)
            : null,
          startAt: s.startAt,
          endAt: s.endAt,
        };
      });
      return {
        monthKey: key,
        month: monthDate.toLocaleDateString('en-US', { month: 'long' }),
        year: String(y),
        totalCount: sessions.length,
        completedCount: sessions.filter((s) => s.status === 'completed').length,
        isCurrentMonth: key === currentMonthKey,
        sessions,
      };
    });
  }

  return {
    upcoming: groupByMonth(upcoming),
    past: groupByMonth(past),
    monthProgressStatsByKey,
  };
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function SpaceSessionsTab({
  schedules,
  isLoading,
  error,
  orgId,
  channelId,
  currentProfileId,
  enableSelfServeActions = false,
}: {
  schedules: ClassScheduleVM[];
  isLoading?: boolean;
  error?: string | null;
  orgId?: string;
  channelId?: string;
  currentProfileId?: string | null;
  enableSelfServeActions?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState<SessionSubTab>('upcoming');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [changeModal, setChangeModal] = useState<ChangeModalState>(null);
  const autoSwitchedRef = useRef(false);
  const rescheduleModalSession =
    changeModal?.kind === 'reschedule' ? changeModal.session : null;
  const rescheduleModalScheduleId = rescheduleModalSession
    ? (rescheduleModalSession.scheduleId ?? rescheduleModalSession.id)
    : '';
  const rescheduleModalOccurrenceKey = rescheduleModalSession?.occurrenceKey ?? '';
  const rescheduleOptionsQuery = useQuery({
    queryKey: queryKeys.selfServeRescheduleOptions(
      orgId ?? '',
      rescheduleModalScheduleId,
      rescheduleModalOccurrenceKey,
    ),
    enabled: Boolean(orgId && rescheduleModalSession && rescheduleModalScheduleId),
    queryFn: () =>
      fetchSelfServeRescheduleOptions({
        orgId: orgId!,
        scheduleId: rescheduleModalScheduleId,
        occurrenceKey: rescheduleModalOccurrenceKey || null,
      }),
  });

  useEffect(() => {
    if (!changeModal || changeModal.kind !== 'reschedule') return;
    if (changeModal.startAtIso) return;
    const firstSlot = rescheduleOptionsQuery.data?.days
      .flatMap((day) => day.slots)
      .find(Boolean);
    if (!firstSlot) return;
    setChangeModal({
      ...changeModal,
      date: formatDateInput(firstSlot.startAt),
      startTime: formatTimeInput(firstSlot.startAt),
      endTime: formatTimeInput(firstSlot.endAt),
      startAtIso: firstSlot.startAt,
      endAtIso: firstSlot.endAt,
      timezone: rescheduleOptionsQuery.data?.timezone ?? null,
    });
  }, [changeModal, rescheduleOptionsQuery.data]);

  const { upcoming, past, monthProgressStatsByKey } = useMemo(
    () => splitAndGroupSessions(schedules),
    [schedules],
  );
  const activeJoinSessionId = useMemo(() => {
    for (const group of upcoming) {
      const joinable = group.sessions.find(
        (session) =>
          !session.disabled &&
          !session.isPast &&
          (!!session.meetingLink || !!session.channelId),
      );
      if (joinable) return joinable.id;
    }
    return null;
  }, [upcoming]);

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-switch to 'past' if upcoming is empty but past has data (first time data loads)
  useEffect(() => {
    if (!autoSwitchedRef.current && upcoming.length === 0 && past.length > 0) {
      autoSwitchedRef.current = true;
      setActiveSubTab('past');
    }
  }, [upcoming, past]);

  // Auto-open current month (or first month) when sub-tab changes or data loads
  useEffect(() => {
    const groups = activeSubTab === 'upcoming' ? upcoming : past;
    const target = groups.find((g) => g.isCurrentMonth) ?? groups[0];
    setExpandedMonths(target ? new Set([target.monthKey]) : new Set());
  }, [activeSubTab, upcoming, past]);

  const groups = activeSubTab === 'upcoming' ? upcoming.slice(0, 4) : past;
  const requestsQuery = useQuery({
    queryKey: queryKeys.sessionChangeRequests(orgId ?? '', channelId ?? ''),
    queryFn: () =>
      fetchSessionChangeRequests({
        orgId: orgId ?? '',
        channelId: channelId ?? null,
      }),
    enabled: Boolean(orgId && channelId && enableSelfServeActions),
    staleTime: 30_000,
  });
  const pendingRequests =
    requestsQuery.data?.filter((request) => request.status === 'pending') ?? [];
  const invalidateSessionData = async () => {
    if (!orgId || !channelId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.spaceSchedules(channelId, orgId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessionChangeRequests(orgId, channelId),
      }),
    ]);
  };
  const cancelMutation = useMutation({
    mutationFn: (session: ClassSession & { note?: string | null }) =>
      selfServeCancelSession({
        orgId: orgId ?? '',
        scheduleId: session.scheduleId ?? session.id,
        occurrenceKey: session.occurrenceKey ?? null,
        note: session.note ?? null,
      }),
    onSuccess: async (result) => {
      setChangeModal(null);
      await invalidateSessionData();
      Alert.alert(
        result.approvalRequired ? 'Request sent' : 'Session canceled',
        result.approvalRequired
          ? 'This change is waiting for approval.'
          : 'The session was updated.',
      );
    },
  });
  const rescheduleMutation = useMutation({
    mutationFn: (input: {
      session: ClassSession;
      date: string;
      startTime: string;
      endTime: string;
      startAtIso?: string | null;
      endAtIso?: string | null;
      timezone?: string | null;
      note?: string | null;
    }) =>
      selfServeRescheduleSession({
        orgId: orgId ?? '',
        scheduleId: input.session.scheduleId ?? input.session.id,
        occurrenceKey: input.session.occurrenceKey ?? null,
        startAt: input.startAtIso ?? combineLocalDateTime(input.date, input.startTime),
        endAt: input.endAtIso ?? combineLocalDateTime(input.date, input.endTime),
        timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        note: input.note ?? null,
      }),
    onSuccess: async (result) => {
      setChangeModal(null);
      await invalidateSessionData();
      Alert.alert(
        result.approvalRequired ? 'Request sent' : 'Session rescheduled',
        result.approvalRequired
          ? 'This change is waiting for approval.'
          : 'The session was updated.',
      );
    },
    onError: (mutationError) => {
      Alert.alert(
        'Unable to reschedule',
        mutationError instanceof Error ? mutationError.message : 'Please try again.',
      );
    },
  });
  const decisionMutation = useMutation({
    mutationFn: (input: { requestId: string; decision: 'approve' | 'reject' }) =>
      input.decision === 'approve'
        ? approveSessionChangeRequest({ requestId: input.requestId })
        : rejectSessionChangeRequest({ requestId: input.requestId }),
    onSuccess: async () => {
      await invalidateSessionData();
    },
    onError: (mutationError) => {
      Alert.alert(
        'Unable to update request',
        mutationError instanceof Error ? mutationError.message : 'Please try again.',
      );
    },
  });
  const undoCancelMutation = useMutation({
    mutationFn: (session: ClassSession) =>
      selfServeUndoCancelSession({
        orgId: orgId ?? '',
        scheduleId: session.scheduleId ?? session.id,
        occurrenceKey: session.occurrenceKey ?? null,
      }),
    onSuccess: async () => {
      await invalidateSessionData();
      Alert.alert('Session kept', 'The session is back on the calendar.');
    },
    onError: (mutationError) => {
      Alert.alert(
        'Unable to keep session',
        mutationError instanceof Error ? mutationError.message : 'Please try again.',
      );
    },
  });
  const switchCancelModalToReschedule = () => {
    setChangeModal((current) => {
      if (!current || current.kind !== 'cancel') return current;
      return {
        kind: 'reschedule',
        session: current.session,
        date: formatDateInput(current.session.startAt),
        startTime: formatTimeInput(current.session.startAt),
        endTime: formatTimeInput(current.session.endAt),
        startAtIso: null,
        endAtIso: null,
        timezone: null,
        note: current.note,
      };
    });
  };

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={s.emptySubtitle}>Loading sessions…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Sub-tabs: Upcoming | Past */}
      <View style={s.subTabBar}>
        {(['upcoming', 'past'] as SessionSubTab[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[s.subTabBtn, activeSubTab === key && s.subTabBtnActive]}
            onPress={() => setActiveSubTab(key)}
            activeOpacity={0.7}
          >
            <Text style={[s.subTabLabel, activeSubTab === key && s.subTabLabelActive]}>
              {key === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {groups.length === 0 ? (
        <View style={s.emptyState}>
          <CalendarDays size={40} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>
            {activeSubTab === 'upcoming'
              ? 'No upcoming sessions'
              : 'No past sessions yet'}
          </Text>
          {activeSubTab === 'upcoming' && past.length > 0 && (
            <TouchableOpacity onPress={() => setActiveSubTab('past')} activeOpacity={0.7}>
              <Text style={[s.emptySubtitle, { color: colors.teal }]}>
                View {past.reduce((n, g) => n + g.totalCount, 0)} past sessions →
              </Text>
            </TouchableOpacity>
          )}
          {activeSubTab === 'past' && upcoming.length > 0 && (
            <TouchableOpacity
              onPress={() => setActiveSubTab('upcoming')}
              activeOpacity={0.7}
            >
              <Text style={[s.emptySubtitle, { color: colors.teal }]}>
                View {upcoming.reduce((n, g) => n + g.totalCount, 0)} upcoming sessions →
              </Text>
            </TouchableOpacity>
          )}
          {schedules.length === 0 && !isLoading && (
            <Text style={s.emptySubtitle}>No sessions scheduled for this space yet</Text>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12 }}
        >
          {pendingRequests.length > 0 ? (
            <View style={s.requestSection}>
              <Text style={s.requestSectionTitle}>Session change requests</Text>
              {pendingRequests.map((request) => (
                <View key={request.id} style={s.requestRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.requestTitle}>
                      {request.type === 'cancel'
                        ? 'Cancel request'
                        : 'Reschedule request'}
                    </Text>
                    <Text style={s.requestMeta}>{formatRequestWindow(request)}</Text>
                    {request.requestedNote ? (
                      <Text style={s.requestMeta}>{request.requestedNote}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[s.requestBtn, { borderColor: colors.teal }]}
                    disabled={decisionMutation.isPending}
                    onPress={() =>
                      decisionMutation.mutate({
                        requestId: request.id,
                        decision: 'approve',
                      })
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={[s.requestBtnTxt, { color: colors.teal }]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.requestBtn, { borderColor: colors.red }]}
                    disabled={decisionMutation.isPending}
                    onPress={() =>
                      decisionMutation.mutate({
                        requestId: request.id,
                        decision: 'reject',
                      })
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={[s.requestBtnTxt, { color: colors.red }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          {groups.map((group) => {
            const isOpen = expandedMonths.has(group.monthKey);
            const progressStats = monthProgressStatsByKey.get(group.monthKey);
            const scheduledCount = progressStats?.scheduledCount ?? group.totalCount;
            const completedCount = progressStats?.completedCount ?? group.completedCount;
            const progressPercent =
              scheduledCount > 0
                ? Math.round((completedCount / scheduledCount) * 100)
                : 0;
            const allComplete = completedCount === scheduledCount && scheduledCount > 0;
            return (
              <View
                key={group.monthKey}
                style={[s.monthSection, group.isCurrentMonth && s.monthSectionCurrent]}
              >
                {/* Month header - collapsible */}
                <TouchableOpacity
                  style={[s.monthHeader, group.isCurrentMonth && s.monthHeaderCurrent]}
                  onPress={() => toggleMonth(group.monthKey)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={s.monthTitleRow}>
                      <Text style={s.monthTitle}>
                        {group.month} {group.year}
                      </Text>
                      {group.isCurrentMonth && (
                        <View style={s.currentMonthBadge}>
                          <Text style={s.currentMonthBadgeTxt}>Current</Text>
                        </View>
                      )}
                      {allComplete && <CheckCircle2 size={14} color={colors.teal} />}
                    </View>
                    <Text style={s.monthMeta}>
                      {scheduledCount} {scheduledCount === 1 ? 'session' : 'sessions'}
                      {completedCount > 0 ? ` · ${completedCount} completed` : ''}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={s.progressBarWrap}>
                    <View style={s.progressBarTrack}>
                      <View
                        style={[
                          s.progressBarFill,
                          { width: `${Math.max(0, Math.min(100, progressPercent))}%` },
                        ]}
                      />
                    </View>
                    <Text style={s.progressPct}>{progressPercent}%</Text>
                  </View>

                  <ChevronDown
                    size={18}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {/* Session cards */}
                {isOpen &&
                  group.sessions.map((session) => {
                    const canChange =
                      enableSelfServeActions &&
                      activeSubTab === 'upcoming' &&
                      !session.isPast &&
                      !session.disabled;
                    const canUndoCancel =
                      enableSelfServeActions &&
                      activeSubTab === 'upcoming' &&
                      !session.isPast &&
                      session.status === 'cancelled' &&
                      Boolean(currentProfileId) &&
                      session.cancelledByProfileId === currentProfileId;

                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        style={s.sessionCardItem}
                        enableCardPress={false}
                        joinEnabled={
                          activeSubTab !== 'upcoming'
                            ? false
                            : session.id === activeJoinSessionId
                        }
                        cancelAction={
                          canChange
                            ? {
                                onPress: () =>
                                  setChangeModal({
                                    kind: 'cancel',
                                    session,
                                    note: '',
                                  }),
                                disabled: cancelMutation.isPending,
                              }
                            : null
                        }
                        rescheduleAction={
                          canChange
                            ? {
                                onPress: () =>
                                  setChangeModal({
                                    kind: 'reschedule',
                                    session,
                                    date: formatDateInput(session.startAt),
                                    startTime: formatTimeInput(session.startAt),
                                    endTime: formatTimeInput(session.endAt),
                                    startAtIso: null,
                                    endAtIso: null,
                                    timezone: null,
                                    note: '',
                                  }),
                                disabled: rescheduleMutation.isPending,
                              }
                            : null
                        }
                        undoCancelAction={
                          canUndoCancel
                            ? {
                                onPress: () => undoCancelMutation.mutate(session),
                                disabled: undoCancelMutation.isPending,
                              }
                            : null
                        }
                      />
                    );
                  })}
              </View>
            );
          })}
        </ScrollView>
      )}
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(changeModal)}
        onRequestClose={() => setChangeModal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setChangeModal(null)}>
          <Pressable
            style={[
              s.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={s.modalHeading}>
              <Text style={s.modalTitle}>
                {changeModal?.kind === 'cancel' ? 'Cancel session' : 'Reschedule session'}
              </Text>
              <Text style={s.modalDescription}>
                {changeModal?.kind === 'cancel'
                  ? 'Rescheduling keeps the class on the calendar. If that does not work, you can cancel and everyone will be notified.'
                  : 'Pick the new date and time, then add a note for the class.'}
              </Text>
            </View>
            {changeModal?.kind === 'reschedule' ? (
              <RescheduleAvailabilityPicker
                colors={colors}
                options={rescheduleOptionsQuery.data}
                isLoading={rescheduleOptionsQuery.isLoading}
                selectedDate={changeModal.date}
                selectedStartAt={changeModal.startAtIso}
                onSelectDay={(date) => {
                  const day = rescheduleOptionsQuery.data?.days.find(
                    (option) => option.date === date,
                  );
                  const firstSlot = day?.slots[0];
                  setChangeModal({
                    ...changeModal,
                    date,
                    startTime: firstSlot
                      ? formatTimeInput(firstSlot.startAt)
                      : changeModal.startTime,
                    endTime: firstSlot
                      ? formatTimeInput(firstSlot.endAt)
                      : changeModal.endTime,
                    startAtIso: firstSlot?.startAt ?? null,
                    endAtIso: firstSlot?.endAt ?? null,
                    timezone: rescheduleOptionsQuery.data?.timezone ?? null,
                  });
                }}
                onSelectSlot={(slot) =>
                  setChangeModal({
                    ...changeModal,
                    date: formatDateInput(slot.startAt),
                    startTime: formatTimeInput(slot.startAt),
                    endTime: formatTimeInput(slot.endAt),
                    startAtIso: slot.startAt,
                    endAtIso: slot.endAt,
                    timezone: rescheduleOptionsQuery.data?.timezone ?? null,
                  })
                }
              />
            ) : null}
            <TextInput
              value={changeModal?.note ?? ''}
              onChangeText={(note) =>
                changeModal ? setChangeModal({ ...changeModal, note }) : undefined
              }
              placeholder="Add a note"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                s.modalInput,
                s.modalTextArea,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            />
            <View style={s.modalActions}>
              {changeModal?.kind === 'cancel' ? (
                <TouchableOpacity
                  style={[
                    s.modalButton,
                    s.modalSecondaryBtn,
                    { backgroundColor: colors.inputBg, borderColor: colors.red },
                  ]}
                  disabled={cancelMutation.isPending || rescheduleMutation.isPending}
                  onPress={() => {
                    if (!changeModal || changeModal.kind !== 'cancel') return;
                    cancelMutation.mutate({
                      ...changeModal.session,
                      note: changeModal.note,
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.modalSecondaryTxt, { color: colors.red }]}>
                    Cancel anyway
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[s.modalButton, s.modalPrimaryBtn]}
                disabled={
                  cancelMutation.isPending ||
                  rescheduleMutation.isPending ||
                  (changeModal?.kind === 'reschedule' && !changeModal.startAtIso)
                }
                onPress={() => {
                  if (!changeModal) return;
                  if (changeModal.kind === 'cancel') {
                    switchCancelModalToReschedule();
                    return;
                  }
                  rescheduleMutation.mutate(changeModal);
                }}
              >
                <Text style={s.modalPrimaryTxt}>
                  {changeModal?.kind === 'cancel' ? 'Reschedule' : 'Request'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalCloseIconButton,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => setChangeModal(null)}
                activeOpacity={0.85}
                accessibilityLabel="Close session change dialog"
              >
                <X size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  const hairline = StyleSheet.hairlineWidth;
  return StyleSheet.create({
    container: {
      flex: 1,
    },

    // Sub-tabs
    subTabBar: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    subTabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: C.inputBg,
    },
    subTabBtnActive: {
      backgroundColor: C.teal,
    },
    subTabLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textMuted,
    },
    subTabLabelActive: {
      color: '#fff',
    },

    // Empty state
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 8,
      paddingBottom: 60,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Month section
    monthSection: {
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    monthSectionCurrent: {
      backgroundColor: C.tealBg + '30',
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    monthHeaderCurrent: {
      backgroundColor: C.tealBg + '40',
    },
    monthTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    monthTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    monthMeta: {
      fontSize: 13,
      color: C.textMuted,
      marginTop: 1,
    },
    currentMonthBadge: {
      backgroundColor: C.tealBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 99,
    },
    currentMonthBadgeTxt: {
      fontSize: 10,
      fontWeight: '700',
      color: C.teal,
    },

    // Progress bar
    progressBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    progressBarTrack: {
      width: 72,
      height: 5,
      backgroundColor: C.inputBg,
      borderRadius: 2.5,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 5,
      backgroundColor: C.teal,
      borderRadius: 2.5,
    },
    progressPct: {
      fontSize: 10,
      color: C.textMuted,
      fontWeight: '500',
      minWidth: 24,
    },

    // SessionCard spacing within the channel sessions list
    sessionCardItem: {
      marginHorizontal: 12,
      marginBottom: 6,
    },
    requestSection: {
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    requestSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textMuted,
      paddingHorizontal: 4,
    },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: hairline,
      borderColor: C.border,
      borderRadius: 12,
      backgroundColor: C.card,
    },
    requestTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: C.text,
    },
    requestMeta: {
      marginTop: 2,
      fontSize: 12,
      color: C.textMuted,
    },
    requestBtn: {
      minHeight: 30,
      justifyContent: 'center',
      borderWidth: hairline,
      borderRadius: 15,
      paddingHorizontal: 10,
    },
    requestBtnTxt: {
      fontSize: 12,
      fontWeight: '700',
    },
    modalInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    modalCard: {
      gap: 16,
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
    },
    modalHeading: {
      gap: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    modalDescription: {
      fontSize: 15,
      lineHeight: 20,
      color: C.textMuted,
    },
    modalInput: {
      minHeight: 42,
      borderWidth: hairline,
      borderColor: C.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      color: C.text,
      backgroundColor: C.inputBg,
      fontSize: 14,
    },
    modalTextArea: {
      minHeight: 82,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
    },
    modalButton: {
      minWidth: 104,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modalSecondaryBtn: {
      borderWidth: 1,
      backgroundColor: C.inputBg,
    },
    modalSecondaryTxt: {
      color: C.text,
      fontSize: 15,
      fontWeight: '600',
    },
    modalPrimaryBtn: {
      backgroundColor: C.teal,
    },
    modalPrimaryTxt: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    modalCloseIconButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      borderWidth: 1,
      backgroundColor: C.inputBg,
    },
  });
}
