'use client';

import { useState } from 'react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  type DisplayClassScheduleVM,
  formatEventTimeForSchedule,
  getDisplayEventState,
  isEventLive,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { EventDialog } from '@iconicedu/ui-web/components/class-schedule/event-dialog';
import { EventLiveIndicator } from '@iconicedu/ui-web/components/class-schedule/event-live-indicator';
import type {
  CancelSessionActionInput,
  EditSessionActionInput,
} from '@iconicedu/ui-web/components/class-schedule/session-action-types';

interface EventCardProps {
  event: DisplayClassScheduleVM;
  compact?: boolean;
  canCancelSession?: boolean;
  canEditSession?: boolean;
  onCancelSession?: (
    event: DisplayClassScheduleVM,
    input: CancelSessionActionInput,
  ) => Promise<void>;
  onEditSession?: (
    event: DisplayClassScheduleVM,
    input: EditSessionActionInput,
  ) => Promise<void>;
}

export function EventCard({
  event,
  compact = false,
  canCancelSession = false,
  canEditSession = false,
  onCancelSession,
  onEditSession,
}: EventCardProps) {
  const timezone = useScheduleDisplayTimeZone();
  const isLive = isEventLive(event);
  const [open, setOpen] = useState(false);
  const startTime = formatEventTimeForSchedule(event, 'startAt', timezone);
  const displayState = getDisplayEventState(event);
  const themeClassName = event.themeKey ? `theme-${event.themeKey}` : '';
  const themeStyle =
    event.themeKey && displayState.kind !== 'exception'
      ? {
          backgroundColor: 'color-mix(in oklab, var(--theme-bg) 12%, transparent)',
          borderColor: 'color-mix(in oklab, var(--theme-bg) 30%, transparent)',
        }
      : undefined;

  const eventButton = (
    <button
      type="button"
      className={cn(
        'relative w-full h-full overflow-hidden rounded-md border p-2 text-left text-sm transition-all',
        'text-foreground',
        displayState.kind === 'exception' &&
          'border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground opacity-75',
        displayState.kind === 'override' && 'ring-1 ring-warning/20',
        themeClassName,
      )}
      style={themeStyle}
    >
      {isLive && <EventLiveIndicator />}

      {compact ? (
        <div className="flex h-full items-center gap-1.5 pr-4 text-xs">
          <span className="font-medium text-foreground truncate">{event.title}</span>
          {displayState.kind === 'exception' && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Skipped
            </span>
          )}
          {displayState.kind === 'override' && (
            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
              Changed
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground truncate">{startTime}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 pr-4">
            <div className="font-medium truncate">{event.title}</div>
            {displayState.kind === 'exception' && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Skipped
              </span>
            )}
            {displayState.kind === 'override' && (
              <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
                Changed
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{startTime}</div>
          {displayState.reason && (
            <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
              {displayState.reason}
            </div>
          )}
        </>
      )}
    </button>
  );

  return (
    <EventDialog
      event={event}
      open={open}
      onOpenChange={setOpen}
      canCancelSession={canCancelSession}
      canEditSession={canEditSession}
      onCancelSession={onCancelSession}
      onEditSession={onEditSession}
    >
      {eventButton}
    </EventDialog>
  );
}
