import { memo, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import type { SessionCompleteMessageVM as SessionCompleteMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import { formatScheduleDisplayValue } from '@iconicedu/ui-web/lib/schedule-display-timezone';

interface SessionCompleteMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: SessionCompleteMessageType;
}

export const SessionCompleteMessage = memo(function SessionCompleteMessage(
  props: SessionCompleteMessageProps,
) {
  const { message, ...baseProps } = props;
  const { session } = message;
  const timezone = useScheduleDisplayTimeZone();

  const [isCompleted, setIsCompleted] = useState(Boolean(session.completedAt));
  const [isReported, setIsReported] = useState(false);

  const sessionDate = formatScheduleDisplayValue(session.startAt, timezone, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleComplete = () => {
    if (isCompleted) return;
    setIsCompleted(true);
  };

  const handleUndo = () => {
    setIsCompleted(false);
    setIsReported(false);
  };

  const handleReport = () => {
    setIsReported(true);
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-primary/5">
      <div className="mt-2 rounded-xl border border-border bg-card p-4 max-w-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>Complete session</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{session.title}</p>

        {isCompleted ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Thank you!</p>
              <p className="mt-1">{sessionDate} session marked as complete.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleUndo}>
                Undo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReport}
                className="text-muted-foreground"
              >
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                Report issue
              </Button>
            </div>
            {isReported ? (
              <p className="text-xs text-muted-foreground">
                Issue reported. We’ll follow up shortly.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3">
            <Button type="button" size="sm" onClick={handleComplete}>
              Mark session complete
            </Button>
          </div>
        )}
      </div>
    </MessageBase>
  );
});
