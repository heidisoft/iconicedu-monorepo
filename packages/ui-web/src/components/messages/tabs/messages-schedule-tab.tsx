'use client';

import { useMemo, useState } from 'react';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { EmptyMessagesState } from '@iconicedu/ui-web/components/messages/empty-state';
import { Button } from '@iconicedu/ui-web/ui/button';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { CalendarDays, Loader2 } from 'lucide-react';
import {
  getResolvedScheduleDisplayMonthKey,
  getJoinableSessionId,
  getMonthProgressStatsByKey,
  groupSchedulesByMonth,
  splitSchedulesByTimeline,
  takeMonthGroups,
  toMonthGroups,
  type ScheduleSubTabKey,
} from './messages-schedule-tab.utils';
import { MonthSection } from './messages-month-section';

interface MessagesScheduleTabProps {
  schedules: ClassScheduleVM[];
  isLoading: boolean;
  error: string | null;
  timezone?: string | null;
}

const MONTH_PAGE_SIZE = 4;

export function MessagesScheduleTab({
  schedules,
  isLoading,
  error,
  timezone,
}: MessagesScheduleTabProps) {
  const displayTimezone = useScheduleDisplayTimeZone(timezone);
  const [activeTab, setActiveTab] = useState<ScheduleSubTabKey>('upcoming');
  const [upcomingMonthLimit, setUpcomingMonthLimit] = useState(MONTH_PAGE_SIZE);
  const [pastMonthLimit, setPastMonthLimit] = useState(MONTH_PAGE_SIZE);
  const { upcoming, past } = useMemo(
    () => splitSchedulesByTimeline(schedules),
    [schedules],
  );
  const allDisplaySchedules = useMemo(() => [...past, ...upcoming], [past, upcoming]);

  const now = useMemo(() => new Date(), []);
  const currentMonthKey = useMemo(
    () => getResolvedScheduleDisplayMonthKey(now, displayTimezone),
    [displayTimezone, now],
  );

  const upcomingMonthGroups = useMemo(
    () => groupSchedulesByMonth(upcoming, displayTimezone),
    [displayTimezone, upcoming],
  );
  const pastMonthGroups = useMemo(
    () => groupSchedulesByMonth(past, displayTimezone),
    [displayTimezone, past],
  );
  const monthProgressStatsByKey = useMemo(
    () => getMonthProgressStatsByKey(allDisplaySchedules, now, displayTimezone),
    [allDisplaySchedules, displayTimezone, now],
  );

  const upcomingGroups = useMemo(
    () =>
      toMonthGroups(
        takeMonthGroups(upcomingMonthGroups, upcomingMonthLimit),
        now,
        displayTimezone,
      ),
    [displayTimezone, upcomingMonthGroups, upcomingMonthLimit, now],
  );
  const joinableSessionId = useMemo(() => getJoinableSessionId(upcoming), [upcoming]);

  const pastGroups = useMemo(
    () =>
      toMonthGroups(
        takeMonthGroups(pastMonthGroups, pastMonthLimit),
        now,
        displayTimezone,
      ),
    [displayTimezone, pastMonthGroups, pastMonthLimit, now],
  );

  const canLoadMoreUpcoming = useMemo(
    () =>
      takeMonthGroups(upcomingMonthGroups, upcomingMonthLimit).length <
      upcomingMonthGroups.length,
    [upcomingMonthGroups, upcomingMonthLimit],
  );

  const canLoadMorePast = useMemo(
    () =>
      takeMonthGroups(pastMonthGroups, pastMonthLimit).length < pastMonthGroups.length,
    [pastMonthGroups, pastMonthLimit],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30 p-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ScheduleSubTabKey)}
        className="min-h-0 flex-1 overflow-hidden"
      >
        <TabsList className="bg-secondary transition-colors duration-200">
          <TabsTrigger value="upcoming" className="gap-1.5">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            Past
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="upcoming"
          className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden space-y-2 motion-reduce:animate-none animate-in fade-in-0 slide-in-from-right-1 duration-200"
        >
          <ScrollArea className="h-full min-h-0 flex-1 pr-1">
            <div className="space-y-2">
              {upcomingGroups.length === 0 ? (
                <div className="flex min-h-[70vh] w-full items-center justify-center">
                  <EmptyMessagesState
                    title="No upcoming sessions"
                    description="Upcoming sessions scheduled for this channel will appear here."
                    icon={<CalendarDays className="size-5" />}
                  />
                </div>
              ) : (
                upcomingGroups.map((group, index) => (
                  <MonthSection
                    key={group.monthKey}
                    group={group}
                    isCurrentMonth={group.monthKey === currentMonthKey}
                    defaultOpen={index === 0}
                    joinableSessionId={joinableSessionId}
                    progressStats={monthProgressStatsByKey.get(group.monthKey)}
                  />
                ))
              )}
              {canLoadMoreUpcoming ? (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setUpcomingMonthLimit((current) => current + MONTH_PAGE_SIZE)
                    }
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="past"
          className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden space-y-2 motion-reduce:animate-none animate-in fade-in-0 slide-in-from-right-1 duration-200"
        >
          <ScrollArea className="h-full min-h-0 flex-1 pr-1">
            <div className="space-y-2">
              {pastGroups.length === 0 ? (
                <div className="flex min-h-[70vh] w-full items-center justify-center">
                  <EmptyMessagesState
                    title="No past sessions yet"
                    description="Completed and past sessions for this channel will appear here."
                    icon={<CalendarDays className="size-5" />}
                  />
                </div>
              ) : (
                pastGroups.map((group, index) => (
                  <MonthSection
                    key={group.monthKey}
                    group={group}
                    isCurrentMonth={false}
                    defaultOpen={index === 0}
                    progressStats={monthProgressStatsByKey.get(group.monthKey)}
                  />
                ))
              )}
              {canLoadMorePast ? (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPastMonthLimit((current) => current + MONTH_PAGE_SIZE)
                    }
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
