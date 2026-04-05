'use client';

import { useMemo, useState } from 'react';
import type { ClassScheduleVM, ClassScheduleViewVM } from '@iconicedu/shared-types';
import { ClassScheduleHeader } from '@iconicedu/ui-web/components/class-schedule/class-schedule-header';
import { WeekView } from '@iconicedu/ui-web/components/class-schedule/week-view';
import { DayView } from '@iconicedu/ui-web/components/class-schedule/day-view';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import {
  type DisplayClassScheduleVM,
  eventTimeToMinutes,
  getClassScheduleEventsForMonthRange,
  getClassScheduleEventsForView,
  getEventDate,
} from '@iconicedu/ui-web/lib/class-schedule-utils';

interface ClassScheduleContainerProps {
  currentDate: Date;
  view: ClassScheduleViewVM;
  onViewChange: (view: ClassScheduleViewVM) => void;
  onDateSelect: (date: Date) => void;
  events: ClassScheduleVM[];
  childrenCount?: number;
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

export function ClassScheduleContainer({
  currentDate,
  view,
  onViewChange,
  onDateSelect,
  events,
  childrenCount,
  canCancelSessions = false,
  canEditSessions = false,
  onCancelSession,
  onEditSession,
}: ClassScheduleContainerProps) {
  const timezone = useScheduleDisplayTimeZone();
  const [classScheduleMonthAnchor, setClassScheduleMonthAnchor] = useState(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
  );

  const classScheduleEventsForDots = useMemo(
    () => getClassScheduleEventsForMonthRange(events, classScheduleMonthAnchor, 1, 1),
    [events, classScheduleMonthAnchor],
  );
  const classScheduleEventsForView = useMemo(
    () => getClassScheduleEventsForView(events, currentDate, view),
    [events, currentDate, view],
  );

  const hasClasses = events.length > 0;
  const nextEvent = useMemo(() => {
    return [...events]
      .filter((event) => getEventDate(event, timezone) > currentDate)
      .sort((a, b) => {
        const dateDiff =
          getEventDate(a, timezone).getTime() - getEventDate(b, timezone).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (
          eventTimeToMinutes(a, 'startAt', timezone) -
          eventTimeToMinutes(b, 'startAt', timezone)
        );
      })[0];
  }, [events, currentDate, timezone]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      onDateSelect(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    newDate.setDate(
      currentDate.getDate() + (view === 'week' ? 7 : 1) * (direction === 'next' ? 1 : -1),
    );
    onDateSelect(newDate);
  };

  return (
    <>
      <ClassScheduleHeader
        currentDate={currentDate}
        view={view}
        onViewChange={onViewChange}
        onNavigate={handleNavigate}
      />

      {view === 'week' ? (
        <WeekView
          currentDate={currentDate}
          events={classScheduleEventsForView}
          onDateSelect={onDateSelect}
          onSwitchToDay={() => onViewChange('day')}
          canCancelSessions={canCancelSessions}
          canEditSessions={canEditSessions}
          onCancelSession={onCancelSession}
          onEditSession={onEditSession}
        />
      ) : (
        <DayView
          currentDate={currentDate}
          events={classScheduleEventsForView}
          classScheduleEvents={classScheduleEventsForDots}
          hasClasses={hasClasses}
          nextEvent={nextEvent}
          childrenCount={childrenCount}
          onDateSelect={onDateSelect}
          onMonthChange={setClassScheduleMonthAnchor}
          canCancelSessions={canCancelSessions}
          canEditSessions={canEditSessions}
          onCancelSession={onCancelSession}
          onEditSession={onEditSession}
        />
      )}
    </>
  );
}
