'use client';

import { useState } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import { CalendarDays, X } from 'lucide-react';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';

interface EventActionsProps {
  event: DisplayClassScheduleVM;
  onClose: () => void;
  canCancelSession?: boolean;
  onCancelSession?: (
    event: DisplayClassScheduleVM,
    reason?: string | null,
  ) => Promise<void>;
}

export function EventActions({
  event,
  onClose,
  canCancelSession = false,
  onCancelSession,
}: EventActionsProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
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
  const showCancelSessionButton =
    canCancelSession && Boolean(onCancelSession) && event.status !== 'cancelled';

  const handleConfirmCancel = async () => {
    if (!onCancelSession) {
      return;
    }

    setIsCancelling(true);
    try {
      await onCancelSession(event, cancelReason);
      setCancelDialogOpen(false);
      setCancelReason('');
      onClose();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {scheduleTabLink ? (
            <Button size="sm" variant="outline" asChild>
              <a href={scheduleTabLink}>
                <CalendarDays className="h-4 w-4 mr-2" />
                View full schedule
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              <CalendarDays className="h-4 w-4 mr-2" />
              View full schedule
            </Button>
          )}
          {showCancelSessionButton ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel session
            </Button>
          ) : null}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          if (isCancelling) {
            return;
          }
          setCancelDialogOpen(open);
          if (!open) {
            setCancelReason('');
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
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`cancel-session-reason-${event.ids.id}`}
            >
              Reason (optional)
            </label>
            <Textarea
              id={`cancel-session-reason-${event.ids.id}`}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
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
                setCancelReason('');
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
    </>
  );
}
