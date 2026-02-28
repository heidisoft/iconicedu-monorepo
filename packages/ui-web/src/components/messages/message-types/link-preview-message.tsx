'use client';

import { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import type { LinkPreviewMessageVM as LinkPreviewMessageType } from '@iconicedu/shared-types';
import { MessageBase, type MessageBaseProps } from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';

interface LinkPreviewMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: LinkPreviewMessageType;
}

export const LinkPreviewMessage = memo(function LinkPreviewMessage(
  props: LinkPreviewMessageProps,
) {
  const { message, ...baseProps } = props;

  return (
    <MessageBase message={message} {...baseProps}>
      {message.content?.text && (
        <MessageTextContent
          text={message.content.text}
          mentions={message.content.mentions}
          className="mb-2"
        />
      )}
      <a
        href={message.link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-md overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent"
      >
        {message.link.imageUrl && (
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img
              src={message.link.imageUrl || '/placeholder.svg'}
              alt={message.link.title}
              className="h-full w-full object-cover transition-transform hover:scale-105"
            />
          </div>
        )}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate mb-1">
                {message.link.title}
              </h3>
              {message.link.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {message.link.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                {message.link.favicon && (
                  <img
                    src={message.link.favicon || '/placeholder.svg'}
                    alt=""
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                )}
                {message.link.siteName && (
                  <span className="text-xs text-muted-foreground truncate">
                    {message.link.siteName}
                  </span>
                )}
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          </div>
        </div>
      </a>
    </MessageBase>
  );
});
