'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClassScheduleContainer, DashboardHeader, toast } from '@iconicedu/ui-web';
import type { ClassScheduleViewVM, ClassScheduleVM } from '@iconicedu/shared-types';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
  EditSessionOutcome,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';
import { ScheduleDisplayTimeZoneProvider } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';
import { toScheduleDisplayDate } from '@iconicedu/ui-web/lib/schedule-display-timezone';
import { cancelClassScheduleSessionAction } from '@iconicedu/web/app/actions/cancel-class-schedule-session';
import { updateClassScheduleSessionAction } from '@iconicedu/web/app/actions/update-class-schedule-session';
import { splitClassScheduleSessionAction } from '@iconicedu/web/app/actions/split-class-schedule-session';
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
  /** enable-class-schedule-series-reschedule flag — gates the "This and
   * following events"/"All events" quick-edit scopes. `canEditSessions`
   * alone still allows today's per-occurrence edit regardless of this flag. */
  canUseSeriesRescheduleScopes: boolean;
  timezone?: string | null;
};

export function ClassScheduleClient({
  events,
  orgSlug,
  canCancelSessions,
  canEditSessions,
  canUseSeriesRescheduleScopes,
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
      const result = await cancelClassScheduleSessionAction({
        orgSlug,
        scheduleId: getBaseScheduleId(event.ids.id),
        occurrenceKey: getEventOccurrenceKey(event),
        reason: input.reason,
      });

      setScheduleEvents((currentEvents) =>
        applyCancelledSessionToSchedules(currentEvents, result),
      );
      toast.success('Session cancelled.');
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
  ): Promise<EditSessionOutcome | void> => {
    try {
      if (input.scope === 'thisAndFollowing') {
        const splitResult = await splitClassScheduleSessionAction({
          orgSlug,
          scheduleId: getBaseScheduleId(event.ids.id),
          occurrenceKey: getEventOccurrenceKey(event),
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          reason: input.reason,
          confirmDropFutureOverrides: input.confirmDropFutureOverrides,
        });

        if ('requiresConfirmation' in splitResult) {
          return splitResult;
        }

        // The series was split into two schedule ids — refetch rather than
        // patch scheduleEvents in place.
        toast.success('Session updated. Future sessions moved to the new day.');
        startTransition(() => router.refresh());
        return;
      }

      const result = await updateClassScheduleSessionAction({
        orgSlug,
        scheduleId: getBaseScheduleId(event.ids.id),
        occurrenceKey: getEventOccurrenceKey(event),
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
        reason: input.reason,
        scope: input.scope === 'all' ? 'all' : 'occurrence',
        confirmDropFutureOverrides: input.confirmDropFutureOverrides,
      });

      if ('requiresConfirmation' in result) {
        return result;
      }

      if (input.scope === 'all') {
        // The whole recurrence rule changed — refetch rather than patch.
        toast.success('Series updated.');
        startTransition(() => router.refresh());
        return;
      }

      setScheduleEvents((currentEvents) =>
        applyUpdatedSessionToSchedules(currentEvents, result),
      );
      toast.success('Session updated.');
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
          canCancelSessions={canCancelSessions}
          canEditSessions={canEditSessions}
          canUseSeriesRescheduleScopes={canUseSeriesRescheduleScopes}
          editFullScheduleHref={canEditSessions ? `/${orgSlug}/admin/classrooms` : null}
          onCancelSession={handleCancelSession}
          onEditSession={handleEditSession}
        />
      </div>
    </ScheduleDisplayTimeZoneProvider>
  );
}
