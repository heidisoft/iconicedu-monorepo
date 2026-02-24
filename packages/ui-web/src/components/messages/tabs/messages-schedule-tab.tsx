'use client';

import { useMemo, useState } from 'react';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { CalendarPlus, CheckCircle2, ChevronDown, ChevronRight, Clock3, Loader2, Video } from 'lucide-react';
import {
  calculateScheduleCompletionPercent,
  formatScheduleDayBadge,
  formatScheduleStatus,
  formatScheduleTimeBadge,
  formatScheduleWeekTitle,
  getScheduleMonthKey,
  groupSchedulesByMonth,
  splitSchedulesByTimeline,
  takeMonthGroups,
  type ScheduleSubTabKey,
} from './messages-schedule-tab.utils';

interface MessagesScheduleTabProps {
  schedules: ClassScheduleVM[];
  isLoading: boolean;
  error: string | null;
}

const MONTH_PAGE_SIZE = 4;
const shortWeekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const monthSummaryText = (sessionCount: number, completedCount: number): string => {
  const sessionLabel = sessionCount === 1 ? 'session' : 'sessions';
  if (completedCount > 0) {
    const completedLabel = completedCount === 1 ? 'completed' : 'completed';
    return `${sessionCount} ${sessionLabel} · ${completedCount} ${completedLabel}`;
  }
  return `${sessionCount} ${sessionLabel}`;
};

export function formatScheduleDateBlockLabel(
  schedule: ClassScheduleVM,
): string {
  return shortWeekdayFormatter.format(new Date(schedule.startAt));
}

export function MessagesScheduleTab({
  schedules,
  isLoading,
  error,
}: MessagesScheduleTabProps) {
  const [subTab, setSubTab] = useState<ScheduleSubTabKey>('upcoming');
  const [upcomingMonthLimit, setUpcomingMonthLimit] = useState(MONTH_PAGE_SIZE);
  const [pastMonthLimit, setPastMonthLimit] = useState(MONTH_PAGE_SIZE);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const { upcoming, past } = useMemo(
    () => splitSchedulesByTimeline(schedules),
    [schedules],
  );

  const upcomingMonthGroups = useMemo(() => groupSchedulesByMonth(upcoming), [upcoming]);
  const pastMonthGroups = useMemo(() => groupSchedulesByMonth(past), [past]);
  const visibleUpcomingMonthGroups = useMemo(
    () => takeMonthGroups(upcomingMonthGroups, upcomingMonthLimit),
    [upcomingMonthGroups, upcomingMonthLimit],
  );
  const visiblePastMonthGroups = useMemo(
    () => takeMonthGroups(pastMonthGroups, pastMonthLimit),
    [pastMonthGroups, pastMonthLimit],
  );
  const monthGroups =
    subTab === 'upcoming' ? visibleUpcomingMonthGroups : visiblePastMonthGroups;
  const canLoadMore =
    subTab === 'upcoming'
      ? visibleUpcomingMonthGroups.length < upcomingMonthGroups.length
      : visiblePastMonthGroups.length < pastMonthGroups.length;
  const monthStats = useMemo(() => {
    const stats = new Map<string, { completed: number; total: number }>();
    schedules.forEach((schedule) => {
      const monthKey = getScheduleMonthKey(schedule);
      const current = stats.get(monthKey) ?? { completed: 0, total: 0 };
      current.total += 1;
      if (schedule.status === 'completed') {
        current.completed += 1;
      }
      stats.set(monthKey, current);
    });
    return stats;
  }, [schedules]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  if (isLoading) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center px-4 text-sm text-muted-foreground"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
      <div className="px-4 pt-4">
        <div className="inline-flex rounded-2xl bg-muted p-1">
          {(['upcoming', 'past'] as const).map((key) => {
            const isActive = subTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSubTab(key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-foreground/90',
                )}
              >
                <span className="text-sm">{key === 'upcoming' ? 'Upcoming' : 'Past'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {monthGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {subTab === 'upcoming' ? 'No upcoming sessions.' : 'No past sessions.'}
            </p>
          ) : null}

          {monthGroups.map((group, groupIndex) => {
            const isCurrentMonth = group.monthKey === currentMonthKey;
            const isExpanded = expandedMonths[group.monthKey] ?? groupIndex === 0;
            const completedCount = monthStats.get(group.monthKey)?.completed ?? 0;
            const percent = calculateScheduleCompletionPercent(group.schedules.length, completedCount);

            return (
              <section key={group.monthKey} className="space-y-3">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between rounded-[26px] p-4 text-left',
                    isCurrentMonth ? 'bg-[#DFEFEA]' : 'bg-transparent',
                  )}
                  onClick={() =>
                    setExpandedMonths((prev) => ({
                      ...prev,
                      [group.monthKey]: !isExpanded,
                    }))
                  }
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{group.monthTitle}</h3>
                      {isCurrentMonth && subTab === 'upcoming' ? (
                        <span className="rounded-full bg-[#BFE9DB] px-2.5 py-1 text-sm font-semibold text-[#0E9F6E]">
                          Current
                        </span>
                      ) : null}
                      {subTab === 'past' && percent === 100 ? (
                        <CheckCircle2 className="h-6 w-6 text-[#0E9F6E]" />
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {monthSummaryText(group.schedules.length, completedCount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-44 rounded-full bg-[#B7E7DD]">
                      <div
                        className="h-3 rounded-full bg-[#0EAB7D]"
                        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                      />
                    </div>
                    <span className="w-10 text-sm text-muted-foreground">{percent}%</span>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded
                  ? group.schedules.map((schedule, scheduleIndex) => {
                      const isToday =
                        new Date(schedule.startAt).toDateString() === new Date().toDateString();
                      const isPrimaryCard =
                        subTab === 'upcoming' && isCurrentMonth && scheduleIndex === 0;
                      const status = formatScheduleStatus(schedule.status);
                      const scheduleStart = new Date(schedule.startAt);

                      return (
                        <article
                          key={schedule.ids.id}
                          className={cn(
                            'flex items-center gap-4 rounded-[32px] border border-border bg-card p-4',
                            isPrimaryCard && 'border-[#8AD9C3] bg-[#DFEFEA]',
                          )}
                        >
                          <div
                            className={cn(
                              'flex w-28 shrink-0 flex-col items-center rounded-3xl px-3 py-2 text-center',
                              isPrimaryCard ? 'bg-[#0EA57A] text-white' : 'bg-muted text-foreground',
                            )}
                          >
                            {isToday ? (
                              <span className="text-sm font-semibold uppercase tracking-wide">
                                TODAY
                              </span>
                            ) : null}
                            <span className="text-sm font-semibold tracking-wide">
                              {formatScheduleDateBlockLabel(schedule)}
                            </span>
                            <span className="text-sm font-semibold leading-none">
                              {scheduleStart.getDate()}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-foreground">
                                {formatScheduleWeekTitle(schedule)}
                              </h4>
                              {subTab === 'upcoming' && isToday ? (
                                <span className="rounded-full bg-[#66CDB1] px-2.5 py-0.5 text-sm font-semibold text-white">
                                  LIVE
                                </span>
                              ) : null}
                              {subTab === 'past' ? (
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-foreground">
                                  {status}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock3 className="h-5 w-5" />
                              <span>{formatScheduleTimeBadge(schedule)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {subTab === 'upcoming' ? (
                              <Button
                                size="lg"
                                className={cn(
                                  'h-12 rounded-full px-6 text-sm font-semibold leading-none',
                                  isPrimaryCard
                                    ? 'bg-[#08A86E] text-white hover:bg-[#089C67]'
                                    : 'bg-[#D8EDE7] text-[#08A86E] hover:bg-[#CCE8DF]',
                                )}
                                asChild={Boolean(schedule.meetingLink)}
                                disabled={!schedule.meetingLink}
                              >
                                {schedule.meetingLink ? (
                                  <a
                                    href={schedule.meetingLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2"
                                  >
                                    <Video className="h-4 w-4" />
                                    {isPrimaryCard ? 'Join Now' : 'Join'}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-2">
                                    <Video className="h-4 w-4" />
                                    Join
                                  </span>
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="lg"
                                className="h-12 rounded-2xl px-4 text-sm text-muted-foreground"
                              >
                                <Video className="h-4 w-4" />
                                Recording
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-full text-muted-foreground"
                            >
                              <CalendarPlus className="h-5 w-5" />
                            </Button>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </article>
                      );
                    })
                  : null}
              </section>
            );
          })}

          {canLoadMore ? (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (subTab === 'upcoming') {
                    setUpcomingMonthLimit((current) => current + MONTH_PAGE_SIZE);
                    return;
                  }
                  setPastMonthLimit((current) => current + MONTH_PAGE_SIZE);
                }}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
