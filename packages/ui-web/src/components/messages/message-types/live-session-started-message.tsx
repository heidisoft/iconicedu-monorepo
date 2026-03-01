'use client';

import { memo } from 'react';
import { Video } from 'lucide-react';
import type { LiveSessionStartedMessageVM as LiveSessionStartedMessageType } from '@iconicedu/shared-types';
import { MessageBase, type MessageBaseProps } from '@iconicedu/ui-web/components/messages/message-base';
import { Button } from '@iconicedu/ui-web/ui/button';

interface LiveSessionStartedMessageProps
  extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: LiveSessionStartedMessageType;
}

export const LiveSessionStartedMessage = memo(function LiveSessionStartedMessage(
  props: LiveSessionStartedMessageProps,
) {
  const { message, ...baseProps } = props;

  return (
    <MessageBase message={message} {...baseProps}>
      <div className="flex max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{message.liveSession.title}</p>
          <p className="text-sm text-muted-foreground">
            {message.liveSession.startedByDisplayName} started this {message.liveSession.provider} live
            session.
          </p>
          {message.liveSession.occurrenceLabel ? (
            <p className="text-xs text-muted-foreground">
              For {message.liveSession.occurrenceLabel}
            </p>
          ) : null}
        </div>
        <Button size="sm" asChild className="w-fit">
          <a href={message.liveSession.joinUrl} target="_blank" rel="noreferrer">
            <Video className="h-4 w-4" />
            Join
          </a>
        </Button>
      </div>
    </MessageBase>
  );
});
