import { memo } from 'react';
import type { MessageMentionVM } from '@iconicedu/shared-types';

import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  confirmExternalMessageLink,
  splitMessageTextByLinks,
} from './message-link.utils';
import { buildMessageTextSegments } from './message-mentions.utils';
import { isEmojiOnlyText } from './message-action-visibility.utils';

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
  const isEmojiOnly = isEmojiOnlyText(text);

  const renderLinkedText = (value: string, keyPrefix: string) =>
    splitMessageTextByLinks(value).map((part, index) => {
      if (part.kind === 'link') {
        return (
          <a
            key={`${keyPrefix}-link-${index}`}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
            onClick={(event) => {
              if (!confirmExternalMessageLink(part.url)) {
                event.preventDefault();
              }
            }}
          >
            {part.value}
          </a>
        );
      }

      return <span key={`${keyPrefix}-text-${index}`}>{part.value}</span>;
    });

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
        return (
          <strong key={`bold-${index}`}>
            {renderLinkedText(part.text, `bold-${index}`)}
          </strong>
        );
      }
      if (part.type === 'italic') {
        return (
          <em key={`italic-${index}`}>
            {renderLinkedText(part.text, `italic-${index}`)}
          </em>
        );
      }
      return (
        <span key={`text-${index}`}>{renderLinkedText(part.text, `text-${index}`)}</span>
      );
    });
  };

  return (
    <p
      className={cn(
        'text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground',
        isEmojiOnly && 'text-4xl leading-tight',
        className,
      )}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{renderFormattedText(segment.text)}</span>;
        }

        return (
          <span
            key={`mention-${segment.mention.profileId}-${segment.mention.start}`}
            className="mx-[1px] inline-flex items-center rounded-md bg-action-subtle px-1.5 py-0.5 font-medium text-action ring-1 ring-action/25"
          >
            @{segment.mention.displayName}
          </span>
        );
      })}
    </p>
  );
});
