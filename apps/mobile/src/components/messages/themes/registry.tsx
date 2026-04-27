import React from 'react';
import { MessageList } from '@/components/messages/message-list';
import { FeedMessageList } from '@/components/messages/themes/feed-message-list';

type MobileMessageUiThemeKey = 'classic' | 'feed';
type MessageListProps = React.ComponentProps<typeof MessageList>;

export type MobileMessageUiTheme = {
  key: MobileMessageUiThemeKey;
  MessageList: React.FC<MessageListProps>;
};

const ClassicMessageList: React.FC<MessageListProps> = (props) => (
  <MessageList {...props} messageUiThemeKey="classic" />
);

const FeedThemeMessageList: React.FC<MessageListProps> = (props) => (
  <FeedMessageList {...props} messageUiThemeKey="feed" />
);

export const MOBILE_MESSAGE_UI_THEME_REGISTRY: Record<
  MobileMessageUiThemeKey,
  MobileMessageUiTheme
> = {
  classic: {
    key: 'classic',
    MessageList: ClassicMessageList,
  },
  feed: {
    key: 'feed',
    MessageList: FeedThemeMessageList,
  },
};

export function resolveMobileMessageUiTheme(key?: string | null): MobileMessageUiTheme {
  if (key === 'feed') return MOBILE_MESSAGE_UI_THEME_REGISTRY.feed;
  return MOBILE_MESSAGE_UI_THEME_REGISTRY.classic;
}
