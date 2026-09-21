import type { MessageVM } from '../vm/message';
import type { MessageMentionVM } from '../vm/message';

export type MessageRealtimeEvent =
  | { type: 'message-added'; message: MessageVM }
  | { type: 'message-updated'; message: MessageVM }
  | { type: 'message-deleted'; messageId: string }
  | {
      type: 'thread_read_state_updated';
      threadId: string;
      unreadCount: number;
      lastReadMessageId: string | null;
      lastReadAt: string | null;
    }
  | { type: 'typing-start'; profileId: string }
  | { type: 'typing-stop'; profileId: string };

export type MessagesRealtimeSubscription = {
  unsubscribe: () => void;
};

export interface MessagesRealtimeClient {
  subscribe: (input: {
    orgId: string;
    channelId: string;
    onEvent: (event: MessageRealtimeEvent) => void;
  }) =>
    | Promise<MessagesRealtimeSubscription | (() => void) | void>
    | MessagesRealtimeSubscription
    | (() => void)
    | void;
  sendTyping?: (input: {
    orgId: string;
    channelId: string;
    profileId: string;
    isTyping: boolean;
  }) => Promise<void> | void;
  broadcastMessageDeleted?: (input: {
    channelId: string;
    messageId: string;
  }) => Promise<void> | void;
  broadcastMessageUpdated?: (input: {
    channelId: string;
    messageId: string;
  }) => Promise<void> | void;
}

export type MessageSendTextInput = {
  orgId: string;
  channelId: string;
  senderProfileId: string;
  content: string;
  mentions?: MessageMentionVM[];
  homework?: {
    kind?: 'homework' | 'lesson';
    title: string;
    description?: string;
    dueAt: string;
    subject?: string;
  } | null;
  threadParentId?: string | null;
  threadId?: string | null;
  /** Id of the message this one is quoting, rendered as a compact reference above the composer and on the message. */
  replyToMessageId?: string | null;
};

export type MessageSendFileInput = {
  orgId: string;
  channelId: string;
  senderProfileId: string;
  name: string;
  storagePath: string;
  thumbnailUrl?: string;
  size?: number;
  mimeType?: string;
  content?: string;
  durationSeconds?: number;
  threadParentId?: string | null;
  threadId?: string | null;
};

export type MessageSendFilesInput = {
  orgId: string;
  channelId: string;
  senderProfileId: string;
  assets: Array<{
    name: string;
    storagePath: string;
    thumbnailUrl?: string;
    size?: number;
    mimeType?: string;
  }>;
  content?: string;
  threadParentId?: string | null;
  threadId?: string | null;
};

export type MessageToggleReactionInput = {
  orgId: string;
  messageId: string;
  emoji: string;
};

export type MessageDeleteInput = {
  orgId: string;
  messageId: string;
};

export type MessageToggleHiddenInput = {
  orgId: string;
  messageId: string;
  isHidden: boolean;
};

export type MessageToggleSavedInput = {
  orgId: string;
  messageId: string;
  isSaved: boolean;
};

export interface MessageWriteClient {
  sendTextMessage: (input: MessageSendTextInput) => Promise<MessageVM>;
  toggleReaction: (input: MessageToggleReactionInput) => Promise<void>;
  toggleSavedMessage: (input: MessageToggleSavedInput) => Promise<void>;
  deleteMessage: (input: MessageDeleteInput) => Promise<void>;
  toggleHiddenMessage: (input: MessageToggleHiddenInput) => Promise<void>;
}

export type MessageMarkUnreadInput = {
  orgId: string;
  channelId: string;
};

export type MessageLinkPreviewFetchInput = {
  orgId: string;
  channelId: string;
  url: string;
};

export type NotificationConversationMode =
  | 'normal'
  | 'mentions_only'
  | 'muted_until'
  | 'muted_until_enabled';

export type NotificationConversationSettingInput = {
  orgId: string;
  scopeKind: 'channel' | 'learning_space';
  scopeId: string;
  mode: NotificationConversationMode;
  /** Required when mode is 'muted_until'; ignored otherwise. */
  mutedUntil?: string | null;
};
