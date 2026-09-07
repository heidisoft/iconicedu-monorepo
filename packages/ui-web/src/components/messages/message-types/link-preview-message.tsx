'use client';

import { memo } from 'react';
import type { LinkPreviewMessageVM as LinkPreviewMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
import { getFeedMessageBubbleClassName } from '../feed-message-bubble.styles';
import { LinkPreviewCard } from '@iconicedu/ui-web/components/messages/link-preview-card';
import { confirmExternalMessageLink } from '@iconicedu/ui-web/components/messages/message-link.utils';

interface LinkPreviewMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: LinkPreviewMessageType;
}

export const LinkPreviewMessage = memo(function LinkPreviewMessage(
  props: LinkPreviewMessageProps,
) {
  const { message, ...baseProps } = props;
  const isFeedTheme = baseProps.messageUiThemeKey === 'feed';
  const caption = message.content?.text?.replace(message.link.url, '').trim();

  return (
    <MessageBase message={message} {...baseProps}>
      {!isFeedTheme && message.content?.text && (
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
        onClick={(event) => {
          if (!confirmExternalMessageLink(message.link.url)) {
            event.preventDefault();
          }
        }}
      >
        <LinkPreviewCard
          url={message.link.url}
          title={message.link.title}
          description={message.link.description}
          imageUrl={message.link.imageUrl}
          siteName={message.link.siteName}
          favicon={message.link.favicon}
          className={`block ${isFeedTheme ? 'w-full' : 'max-w-md'} overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent`}
        />
      </a>
      {isFeedTheme && caption && (
        <div
          className={`mt-2 ${getFeedMessageBubbleClassName(baseProps.currentUserId === message.core.sender.ids.id)}`}
        >
          <MessageTextContent text={caption} mentions={message.content?.mentions} />
        </div>
      )}
    </MessageBase>
  );
});
