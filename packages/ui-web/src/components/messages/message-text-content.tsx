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

  const renderFormattedText = (value: string) => {
    const parts: Array<{ type: 'text' | 'bold' | 'italic'; text: string }> = [];
    const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let cursor = 0;
    let match: RegExpExecArray | null = pattern.exec(value);

    while (match) {
      if (match.index > cursor) {
        parts.push({ type: 'text', text: value.slice(cursor, match.index) });
      }

      if (typeof match[2] === 'string') {
        parts.push({ type: 'bold', text: match[2] });
      } else if (typeof match[3] === 'string') {
        parts.push({ type: 'italic', text: match[3] });
      }

      cursor = match.index + match[0].length;
      match = pattern.exec(value);
    }

    if (cursor < value.length) {
      parts.push({ type: 'text', text: value.slice(cursor) });
    }

    if (parts.length === 0) {
      return value;
    }

    return parts.map((part, index) => {
      if (part.type === 'bold') {
        return <strong key={`bold-${index}`}>{part.text}</strong>;
      }
      if (part.type === 'italic') {
        return <em key={`italic-${index}`}>{part.text}</em>;
      }
      return <span key={`text-${index}`}>{part.text}</span>;
    });
  };

  return (
    <p className={cn('text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground', className)}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{renderFormattedText(segment.text)}</span>;
        }

        return (
          <span
            key={`mention-${segment.mention.profileId}-${segment.mention.start}`}
            className="mx-[1px] inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 font-medium text-sky-900 ring-1 ring-sky-300/80 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-400/30"
          >
            @{segment.mention.displayName}
          </span>
        );
      })}
    </p>
  );
});
