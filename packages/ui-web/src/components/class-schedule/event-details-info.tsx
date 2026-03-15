import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { User, MapPin, Globe } from 'lucide-react';
import {
  formatEventTimeForSchedule,
  getDisplayEventState,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayValue } from '@iconicedu/ui-web/lib/schedule-display-timezone';

interface EventDetailsInfoProps {
  event: ClassScheduleVM;
}

export function EventDetailsInfo({ event }: EventDetailsInfoProps) {
  const timezone = useScheduleDisplayTimeZone();
  const displayTimezone = {
    viewerTimezone: timezone,
    scheduleTimezone: event.timezone ?? event.recurrence?.rule.timezone ?? null,
  };
  const displayState = getDisplayEventState(event);
  const organizer =
    event.participants.find(
      (participant) => participant.role === 'educator' || participant.role === 'staff',
    )?.displayName ?? 'Organizer';
  const visibilityLabel = event.visibility.replace('-', ' ');
  const originalStart =
    displayState.kind === 'override' && displayState.originalStartAt
      ? new Date(displayState.originalStartAt)
      : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
        <span className="text-sm">
          Event by <span className="font-medium">{organizer}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center rounded-full bg-muted">
          <MapPin className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{event.location ?? 'Online'}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center rounded-full bg-muted">
          <Globe className="h-4 w-4" />
        </div>
        <span className="text-sm">{visibilityLabel}</span>
      </div>
      {originalStart && (
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-full bg-muted">
            <MapPin className="h-4 w-4" />
          </div>
          <span className="text-sm text-muted-foreground">
            Originally{' '}
            {formatScheduleDisplayValue(originalStart, displayTimezone, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            at{' '}
            {formatEventTimeForSchedule(
              {
                ...event,
                startAt: displayState.originalStartAt!,
                endAt: displayState.originalEndAt ?? displayState.originalStartAt!,
              },
              'startAt',
              timezone,
            )}
          </span>
        </div>
      )}
      <Separator />
      <div className="text-sm font-semibold">About this event</div>
      <p className="text-sm text-muted-foreground whitespace-pre-line">
        {event.description}
      </p>
    </>
  );
}
