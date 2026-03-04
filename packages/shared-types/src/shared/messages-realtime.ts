import type { MessageVM } from '../vm/message';
import type { MessageMentionVM } from '../vm/message';

export type MessageRealtimeEvent =
  | { type: 'message-added'; message: MessageVM }
  | { type: 'message-updated'; message: MessageVM }
  | { type: 'message-deleted'; messageId: string }
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
    title: string;
    description?: string;
    dueAt: string;
    subject?: string;
  } | null;
  threadParentId?: string | null;
  threadId?: string | null;
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
