import type { MessageVM } from '../vm/message';

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
}

export type MessageSendTextInput = {
  orgId: string;
  channelId: string;
  senderProfileId: string;
  content: string;
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

export interface MessageWriteClient {
  sendTextMessage: (input: MessageSendTextInput) => Promise<MessageVM>;
  toggleReaction: (input: MessageToggleReactionInput) => Promise<void>;
  deleteMessage: (input: MessageDeleteInput) => Promise<void>;
}
