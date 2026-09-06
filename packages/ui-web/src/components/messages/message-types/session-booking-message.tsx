'use client';

import { memo } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { SessionBookingMessageVM as SessionBookingMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayTimeWithZone } from '@iconicedu/ui-web/lib/schedule-display-timezone';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface SessionBookingMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: SessionBookingMessageType;
}

const sessionStatusConfig = {
  scheduled: {
    label: 'Scheduled',
    color: 'bg-info/10 text-info border-info/20',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-success/10 text-success border-success/20',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: AlertCircle,
  },
  completed: {
    label: 'Completed',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    icon: CheckCircle2,
  },
};

export const SessionBookingMessage = memo(function SessionBookingMessage(
  props: SessionBookingMessageProps,
) {
  const { message, ...baseProps } = props;
  const { session } = message;
  const viewerTimezone = useScheduleDisplayTimeZone();
  const scheduleTimezone =
    'timezone' in session && typeof session.timezone === 'string'
      ? session.timezone
      : null;
  const statusInfo = sessionStatusConfig[session.status];
  const StatusIcon = statusInfo.icon;
  const displayTimezone = {
    viewerTimezone,
    scheduleTimezone,
  };

  const formatSessionTime = (date: string) => {
    return formatScheduleDisplayTimeWithZone(date, displayTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-info/5">
      {message.content?.text && (
        <MessageTextContent text={message.content.text} className="mb-2" />
      )}
      <div className="rounded-xl border border-info/20 bg-card overflow-hidden max-w-md">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                <GraduationCap className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Tutoring Session
                </p>
                <p className="text-sm font-semibold text-foreground">{session.title}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn('gap-1', statusInfo.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatSessionTime(session.startAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{session.durationMinutes} minutes</span>
            </div>
            {session.meetingLink && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Video className="h-3 w-3" />
                <a href={session.meetingLink} className="hover:underline truncate">
                  Join video call
                </a>
              </div>
            )}
            {session.location && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{session.location}</span>
              </div>
            )}
          </div>

          <Badge variant="secondary" className="text-[10px] mb-3">
            {session.subject}
          </Badge>

          {session.topics && session.topics.length > 0 && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Topics:</p>
              <ul className="space-y-1">
                {session.topics.map((topic, i) => (
                  <li
                    key={i}
                    className="text-xs text-foreground flex items-start gap-1.5"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {session.status === 'scheduled' && (
          <div className="px-4 py-3 bg-muted/50 border-t border-border flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 bg-transparent">
              Reschedule
            </Button>
            <Button size="sm" className="flex-1">
              Confirm
            </Button>
          </div>
        )}

        {session.status === 'confirmed' && session.meetingLink && (
          <div className="px-4 py-3 bg-muted/50 border-t border-border">
            <Button size="sm" className="w-full gap-2">
              <Video className="h-4 w-4" />
              Join Session
            </Button>
          </div>
        )}
      </div>
    </MessageBase>
  );
});
