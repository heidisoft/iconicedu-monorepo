import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarDays, ChevronDown } from 'lucide-react-native';
import { EmptyState } from '@iconicedu/ui-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';
import { cancelRecurringSessionOccurrence, queryKeys } from '@/lib/api/queries';
import type { AppColors } from '@/lib/theme';
import {
  SessionCard,
  formatOriginalDate,
  formatOriginalTime,
  formatTimeBadge,
  type ClassSession,
} from '@/components/sessions/session-card';

type SessionSubTab = 'upcoming' | 'past';

type DisplaySchedule = ClassScheduleVM & {
  uiMeta?: {
    baseScheduleId: string;
    recurrenceId?: string;
    occurrenceKey?: string;
  };
  uiState?: {
    kind: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

type ScheduleScreenSession = ClassSession & {
  scheduleId: string;
  recurrenceId?: string | null;
  occurrenceKey?: string | null;
  canCancel: boolean;
};

type MonthGroup = {
  monthKey: string;
  month: string;
  year: string;
  sessions: ScheduleScreenSession[];
  isCurrentMonth: boolean;
};

type CancelTarget = ScheduleScreenSession | null;

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
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

function getCalendarWeekOfMonth(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekdayOffset = firstDayOfMonth.getDay();
  return Math.floor((date.getDate() + firstWeekdayOffset - 1) / 7) + 1;
}

function expandSchedules(
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
        expanded.push({
          ...event,
          uiMeta: { baseScheduleId: event.ids.id },
          uiState: { kind: 'default' },
        });
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

    for (const exc of recurrence.exceptions ?? []) {
      const excDayKey = occurrenceDayKey(exc.occurrenceKey);
      if (overrides.has(exc.occurrenceKey) || overridesByDay.has(excDayKey)) continue;
      const originalStart = new Date(exc.occurrenceKey);
      const originalEnd = new Date(originalStart.getTime() + durationMs);
      expanded.push({
        ...event,
        ids: { ...event.ids, id: `${event.ids.id}__${exc.occurrenceKey}__exception` },
        uiMeta: {
          baseScheduleId: event.ids.id,
          recurrenceId: recurrence.ids.id,
          occurrenceKey: exc.occurrenceKey,
        },
        startAt: originalStart.toISOString(),
        endAt: originalEnd.toISOString(),
        status: 'cancelled',
        meetingLink: null,
        recurrence: undefined,
        uiState: {
          kind: 'exception',
          disabled: true,
          reason: exc.reason ?? null,
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
      ) {
        continue;
      }
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
        uiMeta: {
          baseScheduleId: event.ids.id,
          recurrenceId: recurrence.ids.id,
          occurrenceKey,
        },
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
          : { kind: 'default' },
      });

      occurrenceCount++;
    }
  }

  const deduped = new Map<string, DisplaySchedule>();
  for (const schedule of expanded) {
    const key = occurrenceIdentity(schedule);
    const existing = deduped.get(key);
    const priority = (candidate: DisplaySchedule) =>
      candidate.uiState?.kind === 'exception'
        ? 3
        : candidate.uiState?.kind === 'override'
          ? 2
          : 1;
    if (!existing || priority(schedule) > priority(existing)) {
      deduped.set(key, schedule);
    }
  }

  return Array.from(deduped.values());
}

function appendRecurringException(
  schedules: ClassScheduleVM[],
  input: {
    scheduleId: string;
    recurrenceId: string;
    occurrenceKey: string;
    reason?: string;
  },
) {
  return schedules.map((schedule) => {
    if (schedule.ids.id !== input.scheduleId || !schedule.recurrence) return schedule;
    if (schedule.recurrence.ids.id !== input.recurrenceId) return schedule;

    const exists = schedule.recurrence.exceptions?.some(
      (exception) => exception.occurrenceKey === input.occurrenceKey,
    );
    if (exists) return schedule;

    return {
      ...schedule,
      recurrence: {
        ...schedule.recurrence,
        exceptions: [
          ...(schedule.recurrence.exceptions ?? []),
          {
            occurrenceKey: input.occurrenceKey,
            reason: input.reason,
          },
        ],
      },
    };
  });
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Please try again.';
}

function buildScheduleGroups(input: {
  schedules: ClassScheduleVM[];
  profileKind?: string | null;
  now?: Date;
}): { upcoming: MonthGroup[]; past: MonthGroup[] } {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const nowDay = startOfDay(now).getTime();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const rangeEnd = new Date(now.getFullYear() + 2, now.getMonth(), 0);
  const expanded = expandSchedules(input.schedules, rangeStart, rangeEnd);

  const upcoming = expanded.filter(
    (schedule) => new Date(schedule.endAt).getTime() >= nowMs,
  );
  const past = expanded.filter((schedule) => new Date(schedule.endAt).getTime() < nowMs);
  upcoming.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const toGroups = (items: DisplaySchedule[]): MonthGroup[] => {
    const grouped = new Map<string, DisplaySchedule[]>();
    for (const schedule of items) {
      const date = new Date(schedule.startAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(schedule);
    }

    return [...grouped.entries()].map(([monthKey, schedules]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year!, month! - 1, 1);
      const sessionCountByWeek = new Map<number, number>();

      const sessionsForMonth: ScheduleScreenSession[] = schedules.map((schedule) => {
        const start = new Date(schedule.startAt);
        const end = new Date(schedule.endAt);
        const weekNumber = getCalendarWeekOfMonth(start);
        const sessionNumber = (sessionCountByWeek.get(weekNumber) ?? 0) + 1;
        sessionCountByWeek.set(weekNumber, sessionNumber);
        const isPast = end.getTime() < nowMs;
        const canCancel =
          (input.profileKind === 'staff' || input.profileKind === 'owner') &&
          Boolean(schedule.uiMeta?.recurrenceId && schedule.uiMeta?.occurrenceKey) &&
          !isPast &&
          schedule.status !== 'cancelled' &&
          !(schedule.uiState?.disabled ?? false);

        return {
          id: schedule.ids.id,
          scheduleId: schedule.uiMeta?.baseScheduleId ?? schedule.ids.id,
          recurrenceId: schedule.uiMeta?.recurrenceId ?? null,
          occurrenceKey: schedule.uiMeta?.occurrenceKey ?? null,
          canCancel,
          label: `${start.toLocaleDateString('en-US', { month: 'short' })} · Week ${weekNumber} · Session ${sessionNumber}`,
          time: formatTimeBadge(schedule.startAt),
          dayName: start.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: String(start.getDate()),
          isToday: startOfDay(start).getTime() === nowDay,
          isLive: start.getTime() <= nowMs && end.getTime() >= nowMs,
          isPast,
          status: schedule.status,
          meetingLink: schedule.meetingLink ?? null,
          channelId:
            schedule.source.kind === 'class_session'
              ? (schedule.source.channelId ?? null)
              : null,
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
        };
      });

      return {
        monthKey,
        month: monthDate.toLocaleDateString('en-US', { month: 'long' }),
        year: String(year),
        sessions: sessionsForMonth,
        isCurrentMonth: monthKey === currentMonthKey,
      };
    });
  };

  return { upcoming: toGroups(upcoming), past: toGroups(past) };
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 10,
    },
    emptySubtitle: { color: colors.textMuted, fontSize: 14 },
    subTabBar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    subTabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subTabBtnActive: {
      backgroundColor: colors.tealBg,
      borderColor: colors.teal,
    },
    subTabLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    subTabLabelActive: { color: colors.text },
    monthCard: {
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    monthMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    monthBody: { gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
    },
    modalTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
    modalDescription: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    modalLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
    modalInput: {
      minHeight: 96,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      textAlignVertical: 'top',
      fontSize: 14,
    },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalSecondaryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    modalPrimaryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 16,
      backgroundColor: colors.red,
    },
    modalSecondaryTxt: { color: colors.text, fontSize: 14, fontWeight: '600' },
    modalPrimaryTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}

export function ClassScheduleScreen({
  schedules,
  isLoading,
  error,
  orgId,
  profileKind,
  onRefresh,
  isRefreshing = false,
}: {
  schedules: ClassScheduleVM[];
  isLoading?: boolean;
  error?: string | null;
  orgId: string;
  profileKind?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SessionSubTab>('upcoming');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<CancelTarget>(null);
  const [cancelReason, setCancelReason] = useState('');
  const autoSwitchedRef = useRef(false);

  const { upcoming, past } = useMemo(
    () => buildScheduleGroups({ schedules, profileKind }),
    [profileKind, schedules],
  );

  const cancelMutation = useMutation({
    mutationFn: cancelRecurringSessionOccurrence,
    onSuccess: (result, variables) => {
      queryClient.setQueryData<ClassScheduleVM[]>(
        queryKeys.orgSessions(orgId),
        (current) =>
          appendRecurringException(current ?? [], {
            scheduleId: (variables as typeof variables & { scheduleId?: string })
              .scheduleId!,
            recurrenceId: variables.recurrenceId,
            occurrenceKey: result.occurrenceKey,
            reason: result.reason,
          }),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgSessions(orgId) });
      setCancelTarget(null);
      setCancelReason('');
      toast.success('Session cancelled', 'The class schedule has been updated.');
    },
    onError: (mutationError) => {
      toast.error('Unable to cancel session', getErrorMessage(mutationError));
    },
  });

  useEffect(() => {
    if (!autoSwitchedRef.current && upcoming.length === 0 && past.length > 0) {
      autoSwitchedRef.current = true;
      setActiveTab('past');
    }
  }, [upcoming.length, past.length]);

  useEffect(() => {
    const groups = activeTab === 'upcoming' ? upcoming : past;
    const defaultMonth = groups.find((group) => group.isCurrentMonth) ?? groups[0];
    setExpandedMonths(defaultMonth ? new Set([defaultMonth.monthKey]) : new Set());
  }, [activeTab, upcoming, past]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget?.recurrenceId || !cancelTarget?.occurrenceKey) return;

    try {
      await cancelMutation.mutateAsync({
        orgId,
        recurrenceId: cancelTarget.recurrenceId,
        occurrenceKey: cancelTarget.occurrenceKey,
        reason: cancelReason,
        // local cache patch helper needs this
        scheduleId: cancelTarget.scheduleId,
      } as typeof cancelMutation.variables & { scheduleId: string });
    } catch {
      // onError handles the toast; keep dialog open for retry.
    }
  };

  if (isLoading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={s.emptySubtitle}>Loading schedule…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  const groups = activeTab === 'upcoming' ? upcoming : past;

  return (
    <>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          ) : undefined
        }
      >
        <View style={s.subTabBar}>
          {(['upcoming', 'past'] as SessionSubTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[s.subTabBtn, activeTab === tab && s.subTabBtnActive]}
              activeOpacity={0.75}
            >
              <Text style={[s.subTabLabel, activeTab === tab && s.subTabLabelActive]}>
                {tab === 'upcoming' ? 'Upcoming' : 'Past'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {groups.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={32} color={colors.teal} />}
            title={activeTab === 'upcoming' ? 'No upcoming classes' : 'No past classes'}
            description={
              activeTab === 'upcoming'
                ? 'Your class schedule will appear here when sessions are booked.'
                : 'Completed or cancelled sessions will appear here.'
            }
          />
        ) : (
          groups.map((group) => {
            const isExpanded = expandedMonths.has(group.monthKey);
            return (
              <View key={group.monthKey} style={s.monthCard}>
                <TouchableOpacity
                  style={s.monthHeader}
                  onPress={() =>
                    setExpandedMonths((current) => {
                      const next = new Set(current);
                      if (next.has(group.monthKey)) next.delete(group.monthKey);
                      else next.add(group.monthKey);
                      return next;
                    })
                  }
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={s.monthTitle}>
                      {group.month} {group.year}
                    </Text>
                    <Text style={s.monthMeta}>
                      {group.sessions.length} session
                      {group.sessions.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <ChevronDown
                    size={18}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {isExpanded ? (
                  <View style={s.monthBody}>
                    {group.sessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        cancelAction={
                          session.canCancel
                            ? {
                                onPress: () => setCancelTarget(session),
                                accessibilityLabel: 'Cancel class session',
                              }
                            : null
                        }
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(cancelTarget)}
        onRequestClose={() => {
          if (cancelMutation.isPending) return;
          setCancelTarget(null);
          setCancelReason('');
        }}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => {
            if (cancelMutation.isPending) return;
            setCancelTarget(null);
            setCancelReason('');
          }}
        >
          <Pressable style={s.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={{ gap: 8 }}>
              <Text style={s.modalTitle}>Cancel this class?</Text>
              <Text style={s.modalDescription}>
                This cancels only the selected class occurrence. You can include an
                optional reason.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.modalLabel}>Reason (optional)</Text>
              <TextInput
                multiline
                placeholder="Add a note for the cancellation"
                placeholderTextColor={colors.textFaint}
                style={s.modalInput}
                value={cancelReason}
                onChangeText={setCancelReason}
                editable={!cancelMutation.isPending}
              />
            </View>
            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.modalSecondaryBtn}
                onPress={() => {
                  setCancelTarget(null);
                  setCancelReason('');
                }}
                disabled={cancelMutation.isPending}
                activeOpacity={0.75}
              >
                <Text style={s.modalSecondaryTxt}>Keep class</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalPrimaryBtn, cancelMutation.isPending && { opacity: 0.7 }]}
                onPress={() => void handleConfirmCancel()}
                disabled={cancelMutation.isPending}
                activeOpacity={0.75}
              >
                <Text style={s.modalPrimaryTxt}>
                  {cancelMutation.isPending ? 'Cancelling…' : 'Confirm cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
