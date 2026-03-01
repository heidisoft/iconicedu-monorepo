'use client';

import { useState } from 'react';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  formatEventTime,
  getDisplayEventState,
  isEventLive,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { EventDialog } from '@iconicedu/ui-web/components/class-schedule/event-dialog';
import { EventLiveIndicator } from '@iconicedu/ui-web/components/class-schedule/event-live-indicator';

interface EventCardProps {
  event: ClassScheduleVM;
  compact?: boolean;
}

export function EventCard({ event, compact = false }: EventCardProps) {
  const isLive = isEventLive(event);
  const [open, setOpen] = useState(false);
  const startTime = formatEventTime(event.startAt);
  const displayState = getDisplayEventState(event);
  const themeClassName = event.themeKey ? `theme-${event.themeKey}` : '';
  const themeStyle = event.themeKey && displayState.kind !== 'exception'
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
        displayState.kind === 'override' && 'ring-1 ring-amber-500/20',
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
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
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
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
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
    <EventDialog event={event} open={open} onOpenChange={setOpen}>
      {eventButton}
    </EventDialog>
  );
}
