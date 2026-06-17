'use client';

import { memo } from 'react';
import type { LinkPreviewMessageVM as LinkPreviewMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
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
          className="block max-w-md overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent"
        />
      </a>
      {isFeedTheme && caption && (
        <div className="mt-3 rounded-[10px] border border-border/70 bg-background px-4 py-3 text-sm leading-relaxed text-foreground">
          <MessageTextContent text={caption} mentions={message.content?.mentions} />
        </div>
      )}
    </MessageBase>
  );
});
