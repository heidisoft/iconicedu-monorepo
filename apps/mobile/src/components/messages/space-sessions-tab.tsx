import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CalendarDays, ChevronDown, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import {
  ClassSession,
  SessionCard,
  formatWeekTitle,
  formatTimeBadge,
  formatOriginalTime,
  formatOriginalDate,
} from '@/components/sessions/session-card';

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

export type DisplaySchedule = ClassScheduleVM & {
  uiState?: {
    kind: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

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
        status: override?.status ?? event.status,
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

  // Deduplicate: higher priority wins per base-id + day
  const deduped = new Map<string, DisplaySchedule>();
  for (const s of expanded) {
    const baseId = s.ids.id.includes('__')
      ? s.ids.id.slice(0, s.ids.id.indexOf('__'))
      : s.ids.id;
    const key = `${baseId}|${s.startAt.slice(0, 10)}`;
    const existing = deduped.get(key);
    const priority = (ds: DisplaySchedule) =>
      ds.uiState?.kind === 'exception' ? 3 : ds.uiState?.kind === 'override' ? 2 : 1;
    if (!existing || priority(s) > priority(existing)) {
      deduped.set(key, s);
    }
  }

  return Array.from(deduped.values());
}

// ─── Split + group ──────────────────────────────────────────────────────────────

function splitAndGroupSessions(schedules: ClassScheduleVM[]): {
  upcoming: MonthGroup[];
  past: MonthGroup[];
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
      const sessions: ClassSession[] = list.map((s) => {
        const start = new Date(s.startAt);
        const end = new Date(s.endAt);
        const startMs = start.getTime();
        const endMs = end.getTime();
        const startDay = startOfDay(start).getTime();
        // Mirrors web isEventLive: now >= startAt && now <= endAt
        const isLive = startMs <= nowMs && endMs >= nowMs;
        const isPast = endMs < nowMs;
        return {
          id: s.ids.id,
          label: formatWeekTitle(s.startAt),
          time: formatTimeBadge(s.startAt),
          dayName: start.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: String(start.getDate()),
          isToday: startDay === nowDay,
          isLive,
          isPast,
          status: s.status,
          meetingLink: s.meetingLink ?? null,
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

  return { upcoming: groupByMonth(upcoming), past: groupByMonth(past) };
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function SpaceSessionsTab({
  schedules,
  isLoading,
  error,
}: {
  schedules: ClassScheduleVM[];
  isLoading?: boolean;
  error?: string | null;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [activeSubTab, setActiveSubTab] = useState<SessionSubTab>('upcoming');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const autoSwitchedRef = useRef(false);

  const { upcoming, past } = useMemo(() => splitAndGroupSessions(schedules), [schedules]);

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

  const groups = activeSubTab === 'upcoming' ? upcoming.slice(0, 4) : past;

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
          {groups.map((group) => {
            const isOpen = expandedMonths.has(group.monthKey);
            const progressPercent =
              group.totalCount > 0
                ? Math.round((group.completedCount / group.totalCount) * 100)
                : 0;
            const allComplete =
              group.completedCount === group.totalCount && group.totalCount > 0;
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
                      {group.totalCount} {group.totalCount === 1 ? 'session' : 'sessions'}
                      {group.completedCount > 0
                        ? ` · ${group.completedCount} completed`
                        : ''}
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
                  group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      style={s.sessionCardItem}
                    />
                  ))}
              </View>
            );
          })}
        </ScrollView>
      )}
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
      fontSize: 13,
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
      fontSize: 16,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 19,
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
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
    },
    monthMeta: {
      fontSize: 12,
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
      fontSize: 9,
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
      fontSize: 9,
      color: C.textMuted,
      fontWeight: '500',
      minWidth: 24,
    },

    // SessionCard spacing within the channel sessions list
    sessionCardItem: {
      marginHorizontal: 12,
      marginBottom: 6,
    },
  });
}
