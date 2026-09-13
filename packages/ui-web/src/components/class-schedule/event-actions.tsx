'use client';

import { useMemo, useState } from 'react';
import { getLocalDate, getLocalTime, getTimezoneOptions } from '@iconicedu/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { RadioGroup, RadioGroupItem } from '@iconicedu/ui-web/ui/radio-group';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { CalendarCog, CalendarDays, CalendarX, Pencil, X } from 'lucide-react';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
  EditSessionOutcome,
  EditSessionScope,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';

interface EventActionsProps {
  event: DisplayClassScheduleVM;
  onClose: () => void;
  canCancelSession?: boolean;
  canEditSession?: boolean;
  /** enable-class-schedule-series-reschedule flag — gates the "This and
   * following events"/"All events" quick-edit scopes; "This event" (today's
   * per-occurrence edit) is unaffected by this flag. */
  canUseSeriesRescheduleScopes?: boolean;
  onCancelSession?: (
    event: DisplayClassScheduleVM,
    input: CancelSessionActionInput,
  ) => Promise<void>;
  onEditSession?: (
    event: DisplayClassScheduleVM,
    input: EditSessionActionInput,
  ) => Promise<EditSessionOutcome | void>;
}

function addOneHour(time: string) {
  const [hourValue, minuteValue] = time.split(':').map((value) => Number(value));
  const hour = Number.isFinite(hourValue) ? hourValue : 9;
  const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
  return `${((hour + 1) % 24).toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}`;
}

function buildEditDefaults(event: DisplayClassScheduleVM, timezone: string) {
  const startTime = getLocalTime(event.startAt, timezone) ?? '09:00';
  return {
    date: getLocalDate(event.startAt, timezone) ?? event.startAt.slice(0, 10),
    startTime,
    endTime: getLocalTime(event.endAt, timezone) ?? addOneHour(startTime),
    timezone,
    reason: event.uiState?.reason ?? '',
  };
}

/** Whether this recurring event's rule is the simple weekly/single-weekday
 * shape the "This and following"/"All events" quick-edit scopes support.
 * Must match `assertSimpleWeeklyRecurrence` on the API exactly (requires
 * exactly one `byWeekday` entry, not zero-or-one) — a looser client check
 * would show the option only to have the server reject it on submit. */
function isSimpleWeeklyRecurrence(event: DisplayClassScheduleVM) {
  const rule = event.recurrence?.rule;
  if (!rule || rule.frequency !== 'weekly') return false;
  return rule.byWeekday?.length === 1;
}

function isTodayOrLaterLocalDate(occurrenceLocalDate: string, timezone: string) {
  const todayLocalDate = getLocalDate(new Date().toISOString(), timezone) ?? '';
  return occurrenceLocalDate >= todayLocalDate;
}

export function EventActions({
  event,
  onClose,
  canCancelSession = false,
  canEditSession = false,
  canUseSeriesRescheduleScopes = false,
  onCancelSession,
  onEditSession,
}: EventActionsProps) {
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const scheduleTimezone = event.timezone ?? 'UTC';
  const isRecurringSession = event.ids.id.includes('__');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editTimezone, setEditTimezone] = useState(scheduleTimezone);
  const [editReason, setEditReason] = useState('');
  const [editScope, setEditScope] = useState<EditSessionScope>('occurrence');
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    futureOverrideCount: number;
    futureExceptionCount: number;
  } | null>(null);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const scheduleTabLink =
    event.source.kind === 'class_session' && event.source.channelId
      ? (() => {
          if (typeof window === 'undefined') {
            return `/s/${event.source.channelId}#sessions`;
          }
          const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
          const orgBasePath = firstSegment ? `/${firstSegment}` : '';
          return `${orgBasePath}/s/${event.source.channelId}#sessions`;
        })()
      : null;
  const fullScheduleEditLink =
    event.source.kind === 'class_session' && event.source.learningSpaceId
      ? (() => {
          if (typeof window === 'undefined') {
            return `/admin/classrooms/${event.source.learningSpaceId}`;
          }
          const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
          const orgBasePath = firstSegment ? `/${firstSegment}` : '';
          return `${orgBasePath}/admin/classrooms/${event.source.learningSpaceId}`;
        })()
      : null;
  const showSessionActionButtons =
    event.status !== 'cancelled' && event.source.kind === 'class_session';
  const showCancelSessionButton =
    showSessionActionButtons && canCancelSession && Boolean(onCancelSession);
  const showEditSessionButton =
    showSessionActionButtons && canEditSession && Boolean(onEditSession);
  const showEditFullScheduleButton =
    showSessionActionButtons && canEditSession && Boolean(fullScheduleEditLink);
  const isEditTimeRangeValid =
    Boolean(editStartTime) && Boolean(editEndTime) && editStartTime < editEndTime;
  // "This and following"/"All events" only make sense for a simple weekly,
  // single-weekday recurrence on a not-yet-past occurrence — anything more
  // complex (multi-weekday, monthly/yearly) or already-elapsed still only
  // offers "This event" (today's per-occurrence override behavior).
  const canOfferSeriesScopes =
    canUseSeriesRescheduleScopes &&
    isRecurringSession &&
    isSimpleWeeklyRecurrence(event) &&
    isTodayOrLaterLocalDate(
      getLocalDate(event.startAt, scheduleTimezone) ?? event.startAt.slice(0, 10),
      scheduleTimezone,
    );
  // Once a series-wide scope is picked, the date field the admin edits stops
  // meaning "move just this date" and starts meaning "the new pattern's day
  // of week comes from this date" — timezone becomes editable too, since
  // these scopes rewrite the series rather than override one occurrence.
  const lockTimezoneToSchedule = isRecurringSession && editScope === 'occurrence';

  const resetCancelForm = () => {
    setCancelReason('');
  };

  const openEditDialog = () => {
    const defaults = buildEditDefaults(event, scheduleTimezone);
    setEditDate(defaults.date);
    setEditStartTime(defaults.startTime);
    setEditEndTime(defaults.endTime);
    setEditTimezone(defaults.timezone);
    setEditReason(defaults.reason);
    setEditScope('occurrence');
    setPendingConfirmation(null);
    setEditDialogOpen(true);
  };

  const resetEditForm = () => {
    const defaults = buildEditDefaults(event, scheduleTimezone);
    setEditDate(defaults.date);
    setEditStartTime(defaults.startTime);
    setEditEndTime(defaults.endTime);
    setEditTimezone(defaults.timezone);
    setEditReason(defaults.reason);
    setEditScope('occurrence');
    setPendingConfirmation(null);
  };

  const handleConfirmCancel = async () => {
    if (!onCancelSession) {
      return;
    }

    setIsCancelling(true);
    try {
      await onCancelSession(event, {
        reason: cancelReason,
      });
      setCancelDialogOpen(false);
      resetCancelForm();
      onClose();
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmEdit = async (confirmDropFutureOverrides = false) => {
    if (
      !onEditSession ||
      !editDate ||
      !editStartTime ||
      !editEndTime ||
      !isEditTimeRangeValid
    ) {
      return;
    }

    setIsEditingSession(true);
    try {
      const outcome = await onEditSession(event, {
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        timezone: lockTimezoneToSchedule ? scheduleTimezone : editTimezone,
        reason: editReason,
        scope: editScope,
        confirmDropFutureOverrides,
      });
      if (outcome?.requiresConfirmation) {
        setPendingConfirmation({
          futureOverrideCount: outcome.futureOverrideCount,
          futureExceptionCount: outcome.futureExceptionCount,
        });
        return;
      }
      setEditDialogOpen(false);
      resetEditForm();
      onClose();
    } finally {
      setIsEditingSession(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {scheduleTabLink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  asChild
                  aria-label="View full schedule"
                >
                  <a href={scheduleTabLink}>
                    <CalendarDays className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View full schedule</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="View full schedule"
                    disabled
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>View full schedule</TooltipContent>
            </Tooltip>
          )}
          {showEditFullScheduleButton && fullScheduleEditLink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  asChild
                  aria-label="Edit full schedule"
                >
                  <a href={fullScheduleEditLink}>
                    <CalendarCog className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit full schedule</TooltipContent>
            </Tooltip>
          ) : null}
          {showEditSessionButton ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Edit this session"
                  onClick={openEditDialog}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit this session</TooltipContent>
            </Tooltip>
          ) : null}
          {showCancelSessionButton ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  aria-label="Cancel session"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  <CalendarX className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel session</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          if (isCancelling) {
            return;
          }
          setCancelDialogOpen(open);
          if (!open) {
            resetCancelForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
            <DialogDescription>
              Add an optional reason for the cancellation. This session will be marked as
              cancelled on the calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`cancel-session-reason-${event.ids.id}`}>
              Reason (optional)
            </Label>
            <Textarea
              id={`cancel-session-reason-${event.ids.id}`}
              value={cancelReason}
              onChange={(dialogEvent) => setCancelReason(dialogEvent.target.value)}
              placeholder="Add a short note about why this session is cancelled."
              rows={4}
              disabled={isCancelling}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                resetCancelForm();
              }}
              disabled={isCancelling}
            >
              Keep session
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Confirm cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (isEditingSession) {
            return;
          }
          setEditDialogOpen(open);
          if (!open) {
            resetEditForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editScope === 'occurrence'
                ? 'Edit this session'
                : editScope === 'thisAndFollowing'
                  ? 'Edit this and following sessions'
                  : 'Edit all sessions in this series'}
            </DialogTitle>
            <DialogDescription>
              {editScope === 'occurrence'
                ? 'Update the session timing. Recurring sessions reuse the classroom schedule override model for one-off changes.'
                : "The date you pick below sets the new day of week; every occurrence keeps that day and time. Sessions before the split date aren't affected."}
            </DialogDescription>
          </DialogHeader>
          {canOfferSeriesScopes ? (
            <RadioGroup
              value={editScope}
              onValueChange={(value) => {
                setEditScope(value as EditSessionScope);
                setPendingConfirmation(null);
              }}
              className="gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="occurrence"
                  id={`edit-session-scope-occurrence-${event.ids.id}`}
                  disabled={isEditingSession}
                />
                <Label
                  htmlFor={`edit-session-scope-occurrence-${event.ids.id}`}
                  className="cursor-pointer font-normal"
                >
                  This event
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="thisAndFollowing"
                  id={`edit-session-scope-following-${event.ids.id}`}
                  disabled={isEditingSession}
                />
                <Label
                  htmlFor={`edit-session-scope-following-${event.ids.id}`}
                  className="cursor-pointer font-normal"
                >
                  This and following events
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="all"
                  id={`edit-session-scope-all-${event.ids.id}`}
                  disabled={isEditingSession}
                />
                <Label
                  htmlFor={`edit-session-scope-all-${event.ids.id}`}
                  className="cursor-pointer font-normal"
                >
                  All events
                </Label>
              </div>
            </RadioGroup>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-session-date-${event.ids.id}`}>
                {editScope === 'occurrence' ? 'Date' : 'New day (from date)'}
              </Label>
              <Input
                id={`edit-session-date-${event.ids.id}`}
                type="date"
                value={editDate}
                onChange={(dialogEvent) => setEditDate(dialogEvent.target.value)}
                disabled={isEditingSession || Boolean(pendingConfirmation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-session-timezone-${event.ids.id}`}>Timezone</Label>
              <Select
                value={editTimezone}
                onValueChange={setEditTimezone}
                disabled={
                  isEditingSession ||
                  lockTimezoneToSchedule ||
                  Boolean(pendingConfirmation)
                }
              >
                <SelectTrigger id={`edit-session-timezone-${event.ids.id}`}>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map((timezoneOption) => (
                    <SelectItem key={timezoneOption.name} value={timezoneOption.name}>
                      {timezoneOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lockTimezoneToSchedule ? (
                <p className="text-xs text-muted-foreground">
                  One-off recurring edits keep the classroom schedule timezone.
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-session-start-time-${event.ids.id}`}>
                Start time
              </Label>
              <Input
                id={`edit-session-start-time-${event.ids.id}`}
                type="time"
                value={editStartTime}
                onChange={(dialogEvent) => {
                  const newStart = dialogEvent.target.value;
                  setEditStartTime(newStart);
                  if (newStart && editStartTime && editEndTime) {
                    // Calculate duration from current start/end times and apply to new start
                    const [currentHour, currentMin] = editStartTime
                      .split(':')
                      .map(Number);
                    const [endHour, endMin] = editEndTime.split(':').map(Number);
                    const [newHour, newMin] = newStart.split(':').map(Number);

                    const durationMinutes =
                      endHour * 60 + endMin - (currentHour * 60 + currentMin);
                    const newEndMinutes = newHour * 60 + newMin + durationMinutes;
                    const newEndHour = Math.floor(newEndMinutes / 60) % 24;
                    const newEndMin = newEndMinutes % 60;

                    setEditEndTime(
                      `${newEndHour.toString().padStart(2, '0')}:${newEndMin
                        .toString()
                        .padStart(2, '0')}`,
                    );
                  } else if (newStart) {
                    // No previous end time; default to 1 hour
                    setEditEndTime(addOneHour(newStart));
                  }
                }}
                disabled={isEditingSession || Boolean(pendingConfirmation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-session-end-time-${event.ids.id}`}>End time</Label>
              <Input
                id={`edit-session-end-time-${event.ids.id}`}
                type="time"
                value={editEndTime}
                onChange={(dialogEvent) => setEditEndTime(dialogEvent.target.value)}
                disabled={isEditingSession || Boolean(pendingConfirmation)}
              />
              {!isEditTimeRangeValid ? (
                <p className="text-xs text-destructive">
                  End time must be after start time.
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-session-reason-${event.ids.id}`}>
              Reason (optional)
            </Label>
            <Textarea
              id={`edit-session-reason-${event.ids.id}`}
              value={editReason}
              onChange={(dialogEvent) => setEditReason(dialogEvent.target.value)}
              placeholder="Add a short note about the session update."
              rows={3}
              disabled={isEditingSession}
            />
          </div>
          {pendingConfirmation ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              This will drop {pendingConfirmation.futureOverrideCount} upcoming one-off
              change
              {pendingConfirmation.futureOverrideCount === 1 ? '' : 's'} and{' '}
              {pendingConfirmation.futureExceptionCount} upcoming cancellation
              {pendingConfirmation.futureExceptionCount === 1 ? '' : 's'} on the old day —
              they no longer apply once the series moves. Date, time, and timezone are
              locked while this is showing; use Back to change them.
            </div>
          ) : null}
          <DialogFooter>
            {pendingConfirmation ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setPendingConfirmation(null)}
                  disabled={isEditingSession}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleConfirmEdit(true)}
                  disabled={
                    isEditingSession ||
                    !editDate ||
                    !editStartTime ||
                    !editEndTime ||
                    !isEditTimeRangeValid
                  }
                >
                  {isEditingSession ? 'Saving...' : 'Drop overrides & save'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    resetEditForm();
                  }}
                  disabled={isEditingSession}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmEdit(false)}
                  disabled={
                    isEditingSession ||
                    !editDate ||
                    !editStartTime ||
                    !editEndTime ||
                    !isEditTimeRangeValid
                  }
                >
                  {isEditingSession ? 'Saving...' : 'Save changes'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
