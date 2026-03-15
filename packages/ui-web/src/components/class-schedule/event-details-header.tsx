import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { CalendarDays } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { AvatarGroup, AvatarGroupCount } from '@iconicedu/ui-web/ui/avatar';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  formatEventTimeForSchedule,
  getDisplayEventState,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
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
  const maxVisibleGuests = 2;
  const visibleGuests = event.participants.slice(0, maxVisibleGuests);
  const remainingGuests = Math.max(0, event.participants.length - visibleGuests.length);
  const startDate = new Date(event.startAt);

  return (
    <div className="bg-background border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ThemedIconBadge
          icon={CalendarDays}
          themeKey={event.themeKey ?? undefined}
          size="sm"
        />
        <p className="text-sm font-medium">
          {formatScheduleDisplayValue(startDate, displayTimezone, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          at {formatEventTimeForSchedule(event, 'startAt', timezone)}
        </p>
      </div>

      <h2 className="font-semibold">{event.title}</h2>

      {(displayState.kind === 'exception' || displayState.kind === 'override') && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
              displayState.kind === 'exception'
                ? 'bg-muted text-muted-foreground'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
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

      <div className="flex items-center gap-2">
        <AvatarGroup>
          {visibleGuests.map((participant, index) => (
            <AvatarWithStatus
              key={index}
              name={participant.displayName ?? `Guest ${index + 1}`}
              avatar={{ source: 'external', url: participant.avatarUrl ?? '' }}
              themeKey={participant.themeKey ?? null}
              showStatus={false}
              sizeClassName={cn('border-2 border-background')}
            />
          ))}
          {remainingGuests > 0 && (
            <AvatarGroupCount className="text-sm">+{remainingGuests}</AvatarGroupCount>
          )}
        </AvatarGroup>
      </div>
    </div>
  );
}
