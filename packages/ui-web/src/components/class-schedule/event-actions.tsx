'use client';

import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { MessageSquare, Video, X } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface EventActionsProps {
  event: ClassScheduleVM;
  onClose: () => void;
}

export function EventActions({ event, onClose }: EventActionsProps) {
  const joinLink = event.meetingLink ?? null;
  const chatLink =
    event.source.kind === 'class_session' && event.source.channelId
      ? `/s/${event.source.channelId}`
      : null;
  const themeClassName = event.themeKey ? `theme-${event.themeKey}` : '';
  const joinStyle = event.themeKey
    ? {
        backgroundColor: 'color-mix(in oklab, var(--theme-bg) 16%, transparent)',
        borderColor: 'color-mix(in oklab, var(--theme-bg) 32%, transparent)',
        color: 'var(--theme-bg)',
      }
    : undefined;

  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-2">
        {joinLink ? (
          <Button
            size="sm"
            variant="outline"
            className={cn('border', themeClassName)}
            style={joinStyle}
            asChild
          >
            <a href={joinLink} target="_blank" rel="noreferrer">
              <Video className="h-4 w-4 mr-2" />
              Join
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <Video className="h-4 w-4 mr-2" />
            Join
          </Button>
        )}
        {chatLink ? (
          <Button size="sm" variant="outline" asChild>
            <a href={chatLink}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
        )}
      </div>
      <Button size="sm" variant="ghost" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
