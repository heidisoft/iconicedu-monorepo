'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClassScheduleContainer, DashboardHeader, toast } from '@iconicedu/ui-web';
import type { ClassScheduleViewVM, ClassScheduleVM } from '@iconicedu/shared-types';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';
import { ScheduleDisplayTimeZoneProvider } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';
import { toScheduleDisplayDate } from '@iconicedu/ui-web/lib/schedule-display-timezone';
import { cancelClassScheduleSessionAction } from '@iconicedu/web/app/actions/cancel-class-schedule-session';
import {
  selfServeCancelClassSessionAction,
  selfServeRescheduleClassSessionAction,
} from '@iconicedu/web/app/actions/self-serve-class-session-change';
import { updateClassScheduleSessionAction } from '@iconicedu/web/app/actions/update-class-schedule-session';
import {
  applyCancelledSessionToSchedules,
  applyUpdatedSessionToSchedules,
  getBaseScheduleId,
  getEventOccurrenceKey,
} from '@iconicedu/web/app/(app)/[orgSlug]/class-schedule/class-schedule-client.utils';

type ClassScheduleClientProps = {
  events: ClassScheduleVM[];
  orgSlug: string;
  canCancelSessions: boolean;
  canEditSessions: boolean;
  canSelfServeSessionChanges?: boolean;
  timezone?: string | null;
};

export function ClassScheduleClient({
  events,
  orgSlug,
  canCancelSessions,
  canEditSessions,
  canSelfServeSessionChanges = false,
  timezone,
}: ClassScheduleClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const viewParam = searchParams.get('view');

  const initialDate = useMemo(() => {
    if (!dateParam) return toScheduleDisplayDate(new Date(), timezone) ?? new Date();
    const [year, month, day] = dateParam.split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
  }, [dateParam, timezone]);

  const initialView = useMemo<ClassScheduleViewVM>(() => {
    if (viewParam === 'week' || viewParam === 'day' || viewParam === 'month') {
      return viewParam;
    }
    return 'week';
  }, [viewParam]);

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [view, setView] = useState<ClassScheduleViewVM>(initialView);
  const [scheduleEvents, setScheduleEvents] = useState(events);

  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setScheduleEvents(events);
  }, [events]);

  const handleCancelSession = async (
    event: DisplayClassScheduleVM,
    input: CancelSessionActionInput,
  ) => {
    try {
      const scheduleId = getBaseScheduleId(event.ids.id);
      const occurrenceKey = getEventOccurrenceKey(event);
      const result = canCancelSessions
        ? await cancelClassScheduleSessionAction({
            orgSlug,
            scheduleId,
            occurrenceKey,
            reason: input.reason,
          })
        : await selfServeCancelClassSessionAction({
            orgSlug,
            scheduleId,
            occurrenceKey,
            note: input.reason,
          });

      if ('approvalRequired' in result && result.approvalRequired) {
        toast.success('Cancellation request sent for approval.');
      } else if (canCancelSessions) {
        setScheduleEvents((currentEvents) =>
          applyCancelledSessionToSchedules(currentEvents, {
            scheduleId,
            occurrenceKey,
            reason: input.reason ?? null,
            mode: result.mode ?? 'single',
          }),
        );
        toast.success('Session cancelled.');
      } else {
        toast.success('Session cancelled.');
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to cancel this session.',
      );
      throw error;
    }
  };

  const handleEditSession = async (
    event: DisplayClassScheduleVM,
    input: EditSessionActionInput,
  ) => {
    try {
      const scheduleId = getBaseScheduleId(event.ids.id);
      const occurrenceKey = getEventOccurrenceKey(event);
      const result = canEditSessions
        ? await updateClassScheduleSessionAction({
            orgSlug,
            scheduleId,
            occurrenceKey,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            timezone: input.timezone,
            reason: input.reason,
          })
        : await selfServeRescheduleClassSessionAction({
            orgSlug,
            scheduleId,
            occurrenceKey,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            timezone: input.timezone,
            note: input.reason,
          });

      if ('approvalRequired' in result && result.approvalRequired) {
        toast.success('Reschedule request sent for approval.');
      } else if (canEditSessions && !('approvalRequired' in result)) {
        setScheduleEvents((currentEvents) =>
          applyUpdatedSessionToSchedules(currentEvents, result),
        );
        toast.success('Session updated.');
      } else {
        toast.success('Session updated.');
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to update this session.',
      );
      throw error;
    }
  };

  return (
    <ScheduleDisplayTimeZoneProvider timezone={timezone}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <DashboardHeader title="Calendar" />
        <ClassScheduleContainer
          currentDate={currentDate}
          view={view}
          onViewChange={setView}
          onDateSelect={setCurrentDate}
          events={scheduleEvents}
          canCancelSessions={canCancelSessions || canSelfServeSessionChanges}
          canEditSessions={canEditSessions || canSelfServeSessionChanges}
          editFullScheduleHref={canEditSessions ? `/${orgSlug}/admin/classrooms` : null}
          onCancelSession={
            canCancelSessions || canSelfServeSessionChanges
              ? handleCancelSession
              : undefined
          }
          onEditSession={
            canEditSessions || canSelfServeSessionChanges ? handleEditSession : undefined
          }
        />
      </div>
    </ScheduleDisplayTimeZoneProvider>
  );
}
