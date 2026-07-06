'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClassScheduleContainer, DashboardHeader, toast } from '@iconicedu/ui-web';
import type {
  ClassScheduleViewVM,
  ClassScheduleVM,
  SessionChangeRequestVM,
} from '@iconicedu/shared-types';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';
import { ScheduleDisplayTimeZoneProvider } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';
import { toScheduleDisplayDate } from '@iconicedu/ui-web/lib/schedule-display-timezone';
import { cancelClassScheduleSessionAction } from '@iconicedu/web/app/actions/cancel-class-schedule-session';
import {
  approveSessionChangeRequestAction,
  listSessionChangeRequestsAction,
  rejectSessionChangeRequestAction,
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
  canReviewSessionChangeRequests?: boolean;
  timezone?: string | null;
};

export function ClassScheduleClient({
  events,
  orgSlug,
  canCancelSessions,
  canEditSessions,
  canSelfServeSessionChanges = false,
  canReviewSessionChangeRequests = false,
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
        {canReviewSessionChangeRequests ? (
          <SessionChangeRequestInbox
            orgSlug={orgSlug}
            onChanged={() => router.refresh()}
          />
        ) : null}
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

function formatChangeRequestSummary(request: SessionChangeRequestVM) {
  const current = new Date(request.currentStartAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (request.type === 'cancel') return `Cancel ${current}`;
  const requested = request.requestedStartAt
    ? new Date(request.requestedStartAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'new time';
  return `${current} to ${requested}`;
}

function SessionChangeRequestInbox({
  orgSlug,
  onChanged,
}: {
  orgSlug: string;
  onChanged: () => void;
}) {
  const [requests, setRequests] = useState<SessionChangeRequestVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listSessionChangeRequestsAction({ orgSlug })
      .then((items) => {
        if (active) {
          setRequests(items.filter((item) => item.status === 'pending'));
        }
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to load session change requests.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgSlug]);

  const decide = async (requestId: string, decision: 'approve' | 'reject') => {
    setBusyRequestId(requestId);
    try {
      if (decision === 'approve') {
        await approveSessionChangeRequestAction({ orgSlug, requestId });
        toast.success('Session change approved.');
      } else {
        await rejectSessionChangeRequestAction({ orgSlug, requestId });
        toast.success('Session change rejected.');
      }
      setRequests((current) => current.filter((request) => request.id !== requestId));
      startTransition(onChanged);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to update session change request.',
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <section className="border-b bg-background px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Session change requests
          </h2>
          <p className="text-xs text-muted-foreground">
            Review pending cancellations and reschedules.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {request.type === 'cancel' ? 'Cancel request' : 'Reschedule request'}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatChangeRequestSummary(request)}
                </div>
                {request.requestedNote ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {request.requestedNote}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="rounded-md border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                  disabled={busyRequestId === request.id}
                  onClick={() => void decide(request.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
                  disabled={busyRequestId === request.id}
                  onClick={() => void decide(request.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
