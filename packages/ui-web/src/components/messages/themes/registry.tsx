import { forwardRef } from 'react';
import type { ComponentProps } from 'react';
import type { MessageUiThemeKeyVM } from '@iconicedu/shared-types';
import {
  MessageList,
  type MessageListRef,
} from '@iconicedu/ui-web/components/messages/message-list';

type MessageThemeListProps = ComponentProps<typeof MessageList>;

export type WebMessageUiTheme = {
  key: MessageUiThemeKeyVM;
  MessageList: typeof MessageList;
};

const ClassicMessageList = forwardRef<MessageListRef, MessageThemeListProps>(
  function ClassicMessageList(props, ref) {
    return <MessageList ref={ref} {...props} messageUiThemeKey="classic" />;
  },
);

const FeedMessageList = forwardRef<MessageListRef, MessageThemeListProps>(
  function FeedMessageList(props, ref) {
    return <MessageList ref={ref} {...props} messageUiThemeKey="feed" />;
  },
);

export const WEB_MESSAGE_UI_THEME_REGISTRY: Record<
  MessageUiThemeKeyVM,
  WebMessageUiTheme
> = {
  classic: {
    key: 'classic',
    MessageList: ClassicMessageList,
  },
  feed: {
    key: 'feed',
    MessageList: FeedMessageList,
  },
};

export function resolveWebMessageUiTheme(key?: string | null): WebMessageUiTheme {
  if (key === 'feed') return WEB_MESSAGE_UI_THEME_REGISTRY.feed;
  return WEB_MESSAGE_UI_THEME_REGISTRY.classic;
}
