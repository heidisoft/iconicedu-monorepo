import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { User, MapPin, Globe } from 'lucide-react';
import { formatEventTime, getDisplayEventState } from '@iconicedu/ui-web/lib/class-schedule-utils';

interface EventDetailsInfoProps {
  event: ClassScheduleVM;
}

export function EventDetailsInfo({ event }: EventDetailsInfoProps) {
  const displayState = getDisplayEventState(event);
  const organizer =
    event.participants.find((participant) =>
      participant.role === 'educator' || participant.role === 'staff',
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
            Originally {originalStart.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            at {formatEventTime(displayState.originalStartAt!)}
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
