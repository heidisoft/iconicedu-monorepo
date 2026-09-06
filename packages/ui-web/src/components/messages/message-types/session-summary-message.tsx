'use client';

import { memo } from 'react';
import { ClipboardList, Clock, Calendar } from 'lucide-react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { SessionSummaryMessageVM as SessionSummaryMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayTimeWithZone } from '@iconicedu/ui-web/lib/schedule-display-timezone';

interface SessionSummaryMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: SessionSummaryMessageType;
}

export const SessionSummaryMessage = memo(function SessionSummaryMessage(
  props: SessionSummaryMessageProps,
) {
  const { message, ...baseProps } = props;
  const { session } = message;
  const viewerTimezone = useScheduleDisplayTimeZone();
  const scheduleTimezone =
    'timezone' in session && typeof session.timezone === 'string'
      ? session.timezone
      : null;
  const displayTimezone = {
    viewerTimezone,
    scheduleTimezone,
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-info/5">
      {message.content?.text && (
        <MessageTextContent text={message.content.text} className="mb-2" />
      )}
      <div className="rounded-xl border border-info/20 bg-card overflow-hidden max-w-md">
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
              <ClipboardList className="h-5 w-5 text-info" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                Session Summary
              </p>
              <p className="text-sm font-semibold text-foreground">{session.title}</p>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {formatScheduleDisplayTimeWithZone(session.startAt, displayTimezone, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
            {session.durationMinutes ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{session.durationMinutes} minutes</span>
              </div>
            ) : null}
          </div>

          <Badge variant="secondary" className="text-[10px] mb-3">
            Summary
          </Badge>

          <p className="text-sm text-foreground leading-relaxed mb-3">
            {session.summary}
          </p>

          {session.highlights && session.highlights.length > 0 ? (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Highlights
              </p>
              <ul className="space-y-1">
                {session.highlights.map((item, index) => (
                  <li key={index} className="text-xs text-foreground flex gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {session.nextSteps && session.nextSteps.length > 0 ? (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Next steps
              </p>
              <ul className="space-y-1">
                {session.nextSteps.map((item, index) => (
                  <li key={index} className="text-xs text-foreground flex gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </MessageBase>
  );
});
