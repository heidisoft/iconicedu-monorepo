import { memo } from 'react';
import type { MessageMentionVM } from '@iconicedu/shared-types';

import { cn } from '../../lib/utils';
import { buildMessageTextSegments } from './message-mentions.utils';

type MessageTextContentProps = {
  text: string;
  mentions?: MessageMentionVM[];
  className?: string;
};

export const MessageTextContent = memo(function MessageTextContent({
  text,
  mentions,
  className,
}: MessageTextContentProps) {
  const segments = buildMessageTextSegments(text, mentions);

  return (
    <p className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground', className)}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.text}</span>;
        }

        return (
          <span
            key={`mention-${segment.mention.profileId}-${segment.mention.start}`}
            className="mx-[1px] inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800 ring-1 ring-sky-200/80"
          >
            @{segment.mention.displayName}
          </span>
        );
      })}
    </p>
  );
});
