import { memo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { ProgressUpdateMessageVM as ProgressUpdateMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface ProgressUpdateMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: ProgressUpdateMessageType;
}

export const ProgressUpdateMessage = memo(function ProgressUpdateMessage(
  props: ProgressUpdateMessageProps,
) {
  const { message, ...baseProps } = props;
  const { progress } = message;

  const getImprovementColor = (improvement: number) => {
    if (improvement >= 20) return 'text-green-600';
    if (improvement >= 10) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-green-500/5">
      {message.content?.text && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {message.content.text}
        </p>
      )}
      <div className="rounded-xl border border-green-500/20 bg-card overflow-hidden max-w-md">
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                Progress Update
              </p>
              <p className="text-sm font-semibold text-foreground">{progress.summary}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{progress.metric}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {progress.subject}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: `${(progress.currentValue / (progress.targetValue || 100)) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {progress.currentValue}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Previous:{' '}
                <span className="font-medium text-foreground">
                  {progress.previousValue}%
                </span>
              </div>
              <div
                className={cn(
                  'text-xs font-semibold flex items-center gap-1',
                  getImprovementColor(progress.improvement),
                )}
              >
                <TrendingUp className="h-3 w-3" />+{progress.improvement.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </MessageBase>
  );
});
