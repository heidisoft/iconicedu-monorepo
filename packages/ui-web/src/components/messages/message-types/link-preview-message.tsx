'use client';

import { memo } from 'react';
import type { LinkPreviewMessageVM as LinkPreviewMessageType } from '@iconicedu/shared-types';
import { MessageBase, type MessageBaseProps } from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
import { LinkPreviewCard } from '../link-preview-card';

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
        className="block hover:bg-accent"
      >
        <LinkPreviewCard
          url={message.link.url}
          title={message.link.title}
          description={message.link.description}
          imageUrl={message.link.imageUrl}
          siteName={message.link.siteName}
          favicon={message.link.favicon}
          className="block max-w-md overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent"
        />
      </a>
    </MessageBase>
  );
});
