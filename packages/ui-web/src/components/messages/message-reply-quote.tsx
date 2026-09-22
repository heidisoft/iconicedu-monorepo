import { memo } from 'react';
import { CornerUpLeft } from 'lucide-react';
import type { MessageReplyReferenceVM } from '@iconicedu/shared-types';
import { cn } from '@iconicedu/ui-web/lib/utils';

export interface MessageReplyQuoteProps {
  replyTo: MessageReplyReferenceVM;
  /** Whether the original message is currently loaded/reachable in this view. */
  isReachable: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Compact quoted reference to another message, shown above a reply's content (and above
 * the composer while a reply is being drafted). Degrades gracefully to a non-interactive
 * block when the original message can't be found in the currently loaded view.
 */
export const MessageReplyQuote = memo(function MessageReplyQuote({
  replyTo,
  isReachable,
  onClick,
  className,
}: MessageReplyQuoteProps) {
  const content = (
    <>
      <CornerUpLeft
        className="h-3 w-3 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-left">
        <span className="font-medium text-foreground">{replyTo.senderName}</span>
        <span className="text-muted-foreground"> — {replyTo.snippet}</span>
      </span>
    </>
  );

  const sharedClassName = cn(
    'mb-1.5 flex max-w-full items-center gap-1.5 rounded-md border-l-2 border-border bg-muted/40 px-2 py-1 text-xs',
    className,
  );

  if (isReachable && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(sharedClassName, 'transition-colors hover:bg-muted/70')}
        aria-label={`Jump to original message from ${replyTo.senderName}`}
      >
        {content}
      </button>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
});
