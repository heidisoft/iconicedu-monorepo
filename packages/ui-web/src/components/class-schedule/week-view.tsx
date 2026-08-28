'use client';

import {
  type DisplayClassScheduleVM,
  eventTimeToMinutes,
  getWeekDays,
  formatDayName,
  isSameDay,
  getEventDate,
  getTimeSlots,
  getEventLayout,
  getHiddenEventOverflowGroups,
  getCalendarTimelineScrollTop,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { EventCard } from '@iconicedu/ui-web/components/class-schedule/event-card';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { useEffect, useMemo, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import {
  getScheduleDisplayMinutes,
  toScheduleDisplayDate,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';

interface WeekViewProps {
  currentDate: Date;
  events: DisplayClassScheduleVM[];
  onDateSelect?: (date: Date) => void;
  onSwitchToDay?: () => void;
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

export function WeekView({
  currentDate,
  events,
  onDateSelect,
  onSwitchToDay,
  canCancelSessions = false,
  canEditSessions = false,
  onCancelSession,
  onEditSession,
}: WeekViewProps) {
  const timezone = useScheduleDisplayTimeZone();
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const timeSlots = getTimeSlots();
  const now = new Date();
  const today = toScheduleDisplayDate(now, timezone) ?? now;

  const currentTimeMinutes = getScheduleDisplayMinutes(now, timezone);
  const currentTimeOffset = (currentTimeMinutes / 30) * 32;
  const includesToday = weekDays.some((day) => isSameDay(day, today));
  const columnGap = 6;
  const overlapPx = 12;
  const maxVisibleColumns = 3;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const todayEvents = events.filter((event) => {
      return weekDays.some((day) => isSameDay(getEventDate(event, timezone), day));
    });

    let scrollTop: number;
    if (todayEvents.length > 0) {
      const earliestEvent = todayEvents.reduce((earliest, event) => {
        const eventMinutes = eventTimeToMinutes(event, 'startAt', timezone);
        const earliestMinutes = eventTimeToMinutes(earliest, 'startAt', timezone);
        return eventMinutes < earliestMinutes ? event : earliest;
      });

      const eventMinutes = eventTimeToMinutes(earliestEvent, 'startAt', timezone);
      scrollTop = getCalendarTimelineScrollTop(eventMinutes);
    } else {
      scrollTop = 8 * 2 * 32;
    }

    // Add delay on initial mount to ensure DOM is ready
    if (!hasMountedRef.current) {
      if (includesToday) {
        scrollTop = getCalendarTimelineScrollTop(currentTimeMinutes);
      }
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }, 100);
      hasMountedRef.current = true;
    } else {
      scrollContainerRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, [currentDate, currentTimeMinutes, events, includesToday, weekDays, timezone]);

  const handleCellClick = (day: Date) => {
    if (onDateSelect) {
      onDateSelect(day);
    }
  };

  const handleDayHeaderDoubleClick = (day: Date) => {
    if (onDateSelect) {
      onDateSelect(day);
    }
    if (onSwitchToDay) {
      onSwitchToDay();
    }
  };

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-auto">
      <div className="inline-block min-w-full">
        {/* Days header */}
        <div className="sticky top-0 z-20 bg-background border-b">
          <div className="flex">
            <div className="w-20 flex-shrink-0" />
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, currentDate);

              return (
                <button
                  key={index}
                  onClick={() => onDateSelect?.(day)}
                  onDoubleClick={() => handleDayHeaderDoubleClick(day)}
                  className={cn(
                    'flex-1 border-l p-4 text-center min-w-[75px] transition-colors',
                    'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <div className="text-sm text-muted-foreground">
                    {formatDayName(day, timezone)}
                  </div>
                  <div
                    className={cn(
                      'mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors',
                      isToday && 'bg-primary text-primary-foreground',
                      isSelected && !isToday && 'bg-muted text-foreground',
                    )}
                  >
                    {day.getDate()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time grid */}
        <div className="relative">
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

            {/* Day columns */}
            {weekDays.map((day, dayIndex) => {
              const dayEvents = events.filter((event) =>
                isSameDay(getEventDate(event, timezone), day),
              );
              const dayLayout = getEventLayout(dayEvents, timezone);
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, currentDate);
              const overflowGroups = getHiddenEventOverflowGroups(
                dayEvents,
                dayLayout,
                maxVisibleColumns,
                timezone,
              );

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    'relative flex-1 border-l min-w-[75px]',
                    isSelected && 'bg-muted/20',
                  )}
                >
                  {timeSlots.map((_, index) => (
                    <div
                      key={index}
                      className="h-8 border-b hover:bg-muted/40 transition-colors cursor-pointer focus:bg-muted/50"
                      onClick={() => handleCellClick(day)}
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
                    const sideInset = columnGap;
                    const width = 100 / visibleColumns;
                    const left = column * width;
                    const overlapExtra =
                      visibleColumns > 1 ? overlapPx + (visibleColumns === 3 ? 6 : 0) : 0;
                    const overlapOffset = visibleColumns > 1 ? overlapPx * column : 0;

                    const durationMinutes = endMinutes - startMinutes;
                    const isCompact = durationMinutes <= 45;

                    return (
                      <div
                        key={event.ids.id}
                        className="absolute py-1 pointer-events-none"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${left}% + ${sideInset}px - ${overlapOffset}px)`,
                          width: `calc(${width}% - ${sideInset * 2}px + ${overlapExtra}px)`,
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
                    const sideInset = columnGap;
                    const width = 100 / visibleColumns;
                    const left = (visibleColumns - 1) * width;
                    const top = (group.startMinutes / 30) * 32;

                    return (
                      <div
                        key={`more-${dayIndex}-${group.clusterId}-${group.startMinutes}`}
                        className="absolute px-1 py-1 pointer-events-none"
                        style={{
                          top: `${top}px`,
                          left: `calc(${left}% + ${sideInset}px)`,
                          width: `calc(${width}% - ${sideInset * 2}px)`,
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
