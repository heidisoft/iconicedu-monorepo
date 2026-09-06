import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { GridPattern } from '@iconicedu/ui-web/ui/grid-pattern';
import {
  formatEventTimeRange,
  formatEventRecurrenceLabel,
  getDisplayEventState,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayValue } from '@iconicedu/ui-web/lib/schedule-display-timezone';

interface EventDetailsHeaderProps {
  event: ClassScheduleVM;
}

export function EventDetailsHeader({ event }: EventDetailsHeaderProps) {
  const timezone = useScheduleDisplayTimeZone();
  const displayTimezone = {
    viewerTimezone: timezone,
    scheduleTimezone: event.timezone ?? event.recurrence?.rule.timezone ?? null,
  };
  const displayState = getDisplayEventState(event);
  const startDate = new Date(event.startAt);
  const recurrenceLabel = formatEventRecurrenceLabel(event.recurrence);
  const dateLabel = formatScheduleDisplayValue(startDate, displayTimezone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeRange = formatEventTimeRange(event, timezone);

  const themeClass = event.themeKey ? `theme-${event.themeKey}` : undefined;
  const patternStyle = event.themeKey
    ? {
        fill: 'color-mix(in oklab, var(--theme-bg) 12%, transparent)',
        stroke: 'color-mix(in oklab, var(--theme-bg) 20%, transparent)',
      }
    : undefined;

  return (
    <div
      className={cn(
        'relative bg-background border rounded-xl p-4 overflow-hidden',
        themeClass,
      )}
    >
      <GridPattern
        squares={[
          [4, 4],
          [5, 1],
          [8, 2],
          [5, 3],
          [5, 5],
          [10, 10],
          [12, 15],
          [15, 10],
          [10, 15],
        ]}
        className={cn(
          'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
          'inset-x-0 inset-y-[-30%] h-[200%] skew-y-12',
        )}
        style={patternStyle}
      />
      <div className="relative z-10 space-y-3">
        <div>
          <h2 className="font-semibold text-xl mb-2">{event.title}</h2>
          <p className="text-sm text-muted-foreground">
            {dateLabel} · {timeRange}
          </p>
          {recurrenceLabel && (
            <p className="text-sm text-muted-foreground">{recurrenceLabel}</p>
          )}
        </div>

        {(displayState.kind === 'exception' || displayState.kind === 'override') && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                displayState.kind === 'exception'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-warning/10 text-warning',
              )}
            >
              {displayState.kind === 'exception' ? 'Skipped' : 'Changed'}
            </span>
            {displayState.reason && (
              <span className="text-xs text-muted-foreground">{displayState.reason}</span>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">{event.location}</p>
      </div>
    </div>
  );
}
