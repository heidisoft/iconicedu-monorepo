'use client';

import type { ClassScheduleVM } from '@iconicedu/shared-types';
import {
  type DisplayClassScheduleVM,
  eventTimeToMinutes,
  getDisplayNow,
  isSameDay,
  getEventDate,
  formatEventTimeForSchedule,
  getTimeSlots,
  getEventLayout,
  getHiddenEventOverflowGroups,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { EventCard } from '@iconicedu/ui-web/components/class-schedule/event-card';
import { MiniClassSchedule } from '@iconicedu/ui-web/components/class-schedule/mini-class-schedule';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@iconicedu/ui-web/ui/empty';
import { ArrowRight, CalendarX, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import { useEffect, useRef } from 'react';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayValue } from '@iconicedu/ui-web/lib/schedule-display-timezone';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';

interface DayViewProps {
  currentDate: Date;
  events: DisplayClassScheduleVM[];
  classScheduleEvents?: DisplayClassScheduleVM[];
  hasClasses: boolean;
  nextEvent?: ClassScheduleVM;
  childrenCount?: number;
  onDateSelect: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  canCancelSessions?: boolean;
  canEditSessions?: boolean;
  onCancelSession?: (
    event: DisplayClassScheduleVM,
    input: CancelSessionActionInput,
  ) => Promise<void>;
  onEditSession?: (
    event: DisplayClassScheduleVM,
    input: EditSessionActionInput,
  ) => Promise<void>;
}

export function DayView({
  currentDate,
  events,
  classScheduleEvents,
  hasClasses,
  nextEvent,
  childrenCount,
  onDateSelect,
  onMonthChange,
  canCancelSessions = false,
  canEditSessions = false,
  onCancelSession,
  onEditSession,
}: DayViewProps) {
  const timezone = useScheduleDisplayTimeZone();
  const timeSlots = getTimeSlots();
  const dayEvents = events.filter((event) =>
    isSameDay(getEventDate(event, timezone), currentDate),
  );
  const miniScheduleEvents = classScheduleEvents ?? events;
  const hasChildren = childrenCount === undefined ? true : childrenCount > 0;
  const dayLayout = getEventLayout(dayEvents, timezone);
  const maxVisibleColumns = 3;
  const overflowGroups = getHiddenEventOverflowGroups(
    dayEvents,
    dayLayout,
    maxVisibleColumns,
    timezone,
  );

  const today = getDisplayNow(timezone);
  const isToday = isSameDay(currentDate, today);
  const currentHour = today.getHours();
  const currentMinutes = today.getMinutes();
  const currentTimeOffset = (currentHour * 2 + currentMinutes / 30) * 32;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolled = useRef(false);

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLElement;
    if (!container) return;

    // Calculate scroll position
    let scrollTop = 8 * 2 * 32; // Default to 8 AM

    if (dayEvents.length > 0) {
      const earliestEvent = dayEvents.reduce((earliest, event) => {
        const eventMinutes = eventTimeToMinutes(event, 'startAt', timezone);
        const earliestMinutes = eventTimeToMinutes(earliest, 'startAt', timezone);
        return eventMinutes < earliestMinutes ? event : earliest;
      });

      const eventMinutes = eventTimeToMinutes(earliestEvent, 'startAt', timezone);
      const scrollToMinutes = Math.max(0, eventMinutes - 60);
      scrollTop = (scrollToMinutes / 30) * 32;
    }

    if (!hasInitialScrolled.current) {
      hasInitialScrolled.current = true;
      setTimeout(() => {
        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }, 100);
    } else {
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, [currentDate, dayEvents, timezone]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Day schedule */}
      <ScrollArea ref={scrollContainerRef} className="flex-1 border-r">
        <div className="relative min-h-[400px]">
          <div className="flex">
            {/* Time labels */}
            <div className="w-20 flex-shrink-0">
              {timeSlots.map((time, index) => (
                <div
                  key={time}
                  className="h-8 text-xs text-muted-foreground pr-2 text-right pt-1"
                >
                  {index % 2 === 0 ? time : ''}
                </div>
              ))}
            </div>

            {/* Day column */}
            <div className="relative flex-1 border-l">
              {timeSlots.map((_, index) => (
                <div
                  key={index}
                  className="h-8 border-b hover:bg-muted/40 transition-colors cursor-pointer focus:bg-muted/50"
                />
              ))}

              {/* Events */}
              {dayEvents.map((event) => {
                const startMinutes = eventTimeToMinutes(event, 'startAt', timezone);
                const endMinutes = eventTimeToMinutes(event, 'endAt', timezone);
                const top = (startMinutes / 30) * 32;
                const height = ((endMinutes - startMinutes) / 30) * 32;
                const layout = dayLayout.get(event.ids.id);
                const columns = layout?.columns ?? 1;
                const column = layout?.column ?? 0;
                if (column >= maxVisibleColumns) {
                  return null;
                }

                const visibleColumns = Math.min(columns, maxVisibleColumns);
                const gap = 0;
                const width = 100 / visibleColumns;
                const left = column * width;
                const overlapExtra = 0;
                const overlapOffset = 0;

                const durationMinutes = endMinutes - startMinutes;
                const isCompact = durationMinutes <= 45;

                return (
                  <div
                    key={event.ids.id}
                    className="absolute px-1 py-1 pointer-events-none"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(${left}% + ${gap}px - ${overlapOffset}px)`,
                      width: `calc(${width}% - ${gap * 2}px + ${overlapExtra}px)`,
                      zIndex: column + 1,
                    }}
                  >
                    <div className="pointer-events-auto h-full">
                      <EventCard
                        event={event}
                        compact={isCompact}
                        canCancelSession={canCancelSessions}
                        canEditSession={canEditSessions}
                        onCancelSession={onCancelSession}
                        onEditSession={onEditSession}
                      />
                    </div>
                  </div>
                );
              })}
              {overflowGroups.map((group) => {
                const visibleColumns = Math.min(group.columns, maxVisibleColumns);
                const gap = 0;
                const width = 100 / visibleColumns;
                const left = (visibleColumns - 1) * width;
                const top = (group.startMinutes / 30) * 32;

                return (
                  <div
                    key={`more-${group.clusterId}-${group.startMinutes}`}
                    className="absolute px-1 py-1 pointer-events-none"
                    style={{
                      top: `${top}px`,
                      left: `calc(${left}% + ${gap}px)`,
                      width: `calc(${width}% - ${gap * 2}px)`,
                      zIndex: visibleColumns + 1,
                    }}
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="pointer-events-auto inline-flex min-h-6 max-w-full items-center justify-start rounded-md bg-background/95 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm ring-1 ring-border hover:bg-muted w-full"
                        >
                          +{group.hiddenEvents.length} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
                          More events
                        </div>
                        <div className="max-h-48 overflow-auto">
                          {group.hiddenEvents.map((hidden) => (
                            <div key={hidden.ids.id} className="pointer-events-auto">
                              <EventCard
                                event={hidden}
                                canCancelSession={canCancelSessions}
                                canEditSession={canEditSessions}
                                onCancelSession={onCancelSession}
                                onEditSession={onEditSession}
                              />
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}

              {/* Current time indicator */}
              {isToday && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-destructive z-10"
                  style={{ top: `${currentTimeOffset}px` }}
                >
                  <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                </div>
              )}
            </div>
          </div>

          {dayEvents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <Empty className="w-full max-w-sm rounded-xl border bg-background/90 px-6 py-6 shadow-sm">
                {!hasChildren ? (
                  <>
                    <EmptyHeader className="items-center text-center">
                      <EmptyMedia variant="icon">
                        <UserPlus className="size-5" aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>Add your child to get started</EmptyTitle>
                      <EmptyDescription>
                        You need at least one child profile to see classes.
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button size="sm">
                      <UserPlus className="mr-2 size-4" />
                      Add a child
                    </Button>
                  </>
                ) : !hasClasses ? (
                  <>
                    <EmptyHeader className="items-center text-center">
                      <EmptyMedia variant="icon">
                        <CalendarX className="size-5" aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>No upcoming sessions yet</EmptyTitle>
                      <EmptyDescription>
                        Explore classes to start scheduling and find the right support for
                        your child.
                      </EmptyDescription>
                    </EmptyHeader>
                  </>
                ) : (
                  <>
                    <EmptyHeader className="items-center text-center">
                      <EmptyTitle>No events today</EmptyTitle>
                      <EmptyDescription>
                        {nextEvent
                          ? `Next up: ${nextEvent.title} at ${formatEventTimeForSchedule(nextEvent, 'startAt', timezone)}`
                          : 'No upcoming events scheduled'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {nextEvent && (
                      <Button
                        size="sm"
                        onClick={() => onDateSelect(getEventDate(nextEvent, timezone))}
                      >
                        <ArrowRight className="mr-2 size-4" />
                        Next up:{' '}
                        {formatScheduleDisplayValue(
                          nextEvent.startAt,
                          {
                            viewerTimezone: timezone,
                            scheduleTimezone:
                              nextEvent.timezone ??
                              nextEvent.recurrence?.rule.timezone ??
                              null,
                          },
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </Button>
                    )}
                  </>
                )}
              </Empty>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Right sidebar */}
      <aside className="hidden lg:flex w-80 flex-shrink-0 bg-muted/30">
        <ScrollArea className="w-full">
          <div className="p-4 space-y-4">
            <MiniClassSchedule
              currentDate={currentDate}
              selectedDate={currentDate}
              onDateSelect={onDateSelect}
              events={miniScheduleEvents}
              onMonthChange={onMonthChange}
            />
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}
