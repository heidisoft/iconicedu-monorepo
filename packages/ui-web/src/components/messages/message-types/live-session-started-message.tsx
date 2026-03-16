'use client';

import { memo } from 'react';
import { Video } from 'lucide-react';
import type { LiveSessionStartedMessageVM as LiveSessionStartedMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { Button } from '@iconicedu/ui-web/ui/button';
import { getLiveSessionStartedMessageState } from '@iconicedu/ui-web/components/messages/message-types/live-session-started-message.utils';

interface LiveSessionStartedMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: LiveSessionStartedMessageType;
}

export const LiveSessionStartedMessage = memo(function LiveSessionStartedMessage(
  props: LiveSessionStartedMessageProps,
) {
  const { message, ...baseProps } = props;
  const viewState = getLiveSessionStartedMessageState(message);

  return (
    <MessageBase message={message} {...baseProps}>
      <div
        className={`flex max-w-md flex-col gap-3 rounded-2xl border p-4 ${
          viewState.ended
            ? 'border-border/70 bg-muted/40 text-muted-foreground'
            : 'border-border bg-card'
        }`}
      >
        <div className="space-y-1">
          <p
            className={`text-sm font-semibold ${viewState.ended ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            {viewState.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {message.liveSession.startedByDisplayName}{' '}
            {viewState.ended
              ? `ended this ${message.liveSession.provider} live session.`
              : `started this ${message.liveSession.provider} live session.`}
          </p>
          {message.liveSession.occurrenceLabel ? (
            <p className="text-xs text-muted-foreground">
              For {message.liveSession.occurrenceLabel}
            </p>
          ) : null}
        </div>
        <Button
          size="sm"
          asChild
          className={`w-fit ${viewState.buttonClassName ?? ''}`}
          disabled={viewState.ended}
          variant={viewState.ended ? 'outline' : 'default'}
        >
          <a
            href={viewState.ended ? undefined : message.liveSession.joinUrl}
            aria-disabled={viewState.ended}
            onClick={(event) => {
              if (viewState.ended) {
                event.preventDefault();
              }
            }}
          >
            <Video className="h-4 w-4" />
            {viewState.buttonLabel}
          </a>
        </Button>
      </div>
    </MessageBase>
  );
});
