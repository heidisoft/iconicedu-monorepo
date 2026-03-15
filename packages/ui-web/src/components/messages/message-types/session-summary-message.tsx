'use client';

import { memo } from 'react';
import { ClipboardList, Clock, Calendar } from 'lucide-react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { SessionSummaryMessageVM as SessionSummaryMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayValue } from '@iconicedu/ui-web/lib/schedule-display-timezone';

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
  const timezone = useScheduleDisplayTimeZone();

  return (
    <MessageBase message={message} {...baseProps} className="bg-indigo-500/5">
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div className="rounded-xl border border-indigo-500/20 bg-card overflow-hidden max-w-md">
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
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
                {formatScheduleDisplayValue(session.startAt, timezone, {
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
