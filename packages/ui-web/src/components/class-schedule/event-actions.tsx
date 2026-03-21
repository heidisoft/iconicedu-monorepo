'use client';

import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { CalendarDays, X } from 'lucide-react';

interface EventActionsProps {
  event: ClassScheduleVM;
  onClose: () => void;
}

export function EventActions({ event, onClose }: EventActionsProps) {
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

  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-2">
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
      </div>
      <Button size="sm" variant="ghost" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
