'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type {
  ChannelVM,
  ConnectionVM,
  MessageMentionVM,
  MessagesRightPanelIntent,
  MessagesRightPanelIntentKey,
  MessagesRightSidebarState,
  MessageVM,
  TextMessageVM,
  ThreadVM,
  UUID,
} from '@iconicedu/shared-types';

type ThreadData = {
  thread: ThreadVM;
  replies: ConnectionVM<MessageVM>;
  parentMessage?: MessageVM;
};

export type MessageActionState = {
  isSaving?: boolean;
  isHiding?: boolean;
  isDeleting?: boolean;
  isAddingReaction?: boolean;
  pendingReactionEmojis?: string[];
};

interface MessagesStateContextValue {
  channel: ChannelVM;
  isReadOnly: boolean;
  currentUserId: string;
  savedCount: number;
  homeworkCount: number;
  sessionSummaryCount: number;
  messages: MessageVM[];
  messageFilter: MessageFilterKey | null;
  showCreateMessageTypeButton: boolean;
  createTextMessage: (
    content: string,
    mentions?: MessageMentionVM[],
  ) => TextMessageVM | null;
  sendTextMessage: SendTextMessageHandler;
  sendFileMessage: SendFileMessageHandler;
  joinLiveSession?: JoinLiveSessionHandler;
  threadHandlers: ThreadActionHandlers;
  state: MessagesRightSidebarState;
  open: (intent: MessagesRightPanelIntent) => void;
  close: () => void;
  toggle: (intent: MessagesRightPanelIntent) => void;
  isActive: (
    key: MessagesRightPanelIntentKey,
    intent?: MessagesRightPanelIntent,
  ) => boolean;
  setCurrentUserId: (userId: string) => void;
  setSavedCount: (count: number) => void;
  setHomeworkCount: (count: number) => void;
  setSessionSummaryCount: (count: number) => void;
  setMessages: (messages: MessageVM[]) => void;
  setCreateTextMessage: (
    factory: (content: string, mentions?: MessageMentionVM[]) => TextMessageVM | null,
  ) => void;
  setSendTextMessage: (handler: SendTextMessageHandler) => void;
  setSendFileMessage: (handler: SendFileMessageHandler) => void;
  setJoinLiveSession: (handler: JoinLiveSessionHandler | undefined) => void;
  setThreadHandlers: (handlers: ThreadActionHandlers) => void;
  toggleMessageFilter: (key: MessageFilterKey) => void;
  appendThreadMessage: (threadId: UUID, message: MessageVM) => void;
  setThreadData: (
    thread: ThreadVM,
    data: { replies: ConnectionVM<MessageVM>; parentMessage?: MessageVM },
  ) => void;
  getThreadData: (threadId: UUID) => ThreadData | undefined;
  getMessageActionState: (messageId: UUID) => MessageActionState | undefined;
  setGetMessageActionState: (
    handler: (messageId: UUID) => MessageActionState | undefined,
  ) => void;
  setScrollToMessage: (handler: (messageId: string) => void) => void;
  scrollToMessage?: (messageId: string) => void;
}

type ThreadActionHandlers = {
  onAddMessage?: (message: MessageVM) => void;
  onUpdateMessage?: (messageId: string, updates: Partial<MessageVM>) => void;
  onDeleteMessage?: (messageId: string) => void;
  onToggleReaction?: (
    messageId: string,
    emoji: string,
    source?: 'bar' | 'picker',
  ) => void;
  onToggleSaved?: (messageId: string) => void;
  onToggleHidden?: (messageId: string) => void;
};

export type SendTextMessageHandler = (input: {
  content: string;
  mentions?: MessageMentionVM[];
  homework?: {
    kind?: 'homework' | 'lesson';
    title: string;
    description?: string;
    dueAt: string;
    subject?: string;
  } | null;
  threadId?: string | null;
  threadParentId?: string | null;
}) => Promise<MessageVM | null>;

export type SendFileMessageHandler = (input: {
  attachments: Array<{ file: File; durationSeconds?: number }>;
  content?: string;
  threadId?: string | null;
  threadParentId?: string | null;
}) => Promise<MessageVM | null>;

export type JoinLiveSessionHandler = () => Promise<void>;

export type MessageFilterKey = 'homework' | 'session-summary';

const MessagesStateContext = createContext<MessagesStateContextValue | null>(null);

const isSameIntent = (
  a: MessagesRightPanelIntent | null,
  b: MessagesRightPanelIntent,
) => {
  if (!a) return false;
  if (a.key !== b.key) return false;
  if (a.key === 'profile' && b.key === 'profile') {
    return a.userId === b.userId;
  }
  if (a.key === 'thread' && b.key === 'thread') {
    return a.threadId === b.threadId;
  }
  return true;
};

export function MessagesStateProvider({
  channel,
  isReadOnly = false,
  showCreateMessageTypeButton = true,
  children,
}: {
  channel: ChannelVM;
  isReadOnly?: boolean;
  showCreateMessageTypeButton?: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<MessagesRightSidebarState>({
    isOpen: false,
    intent: null,
  });
  const [currentUserId, setCurrentUserId] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [homeworkCount, setHomeworkCount] = useState(0);
  const [sessionSummaryCount, setSessionSummaryCount] = useState(0);
  const [messages, setMessages] = useState<MessageVM[]>([]);
  const [messageFilter, setMessageFilter] = useState<MessageFilterKey | null>(null);
  const [createTextMessage, setCreateTextMessage] = useState<
    (content: string, mentions?: MessageMentionVM[]) => TextMessageVM | null
  >(() => () => null);
  const [sendTextMessage, setSendTextMessage] = useState<SendTextMessageHandler>(
    async () => null,
  );
  const [sendFileMessage, setSendFileMessage] = useState<SendFileMessageHandler>(
    async () => null,
  );
  const [joinLiveSession, setJoinLiveSession] = useState<
    JoinLiveSessionHandler | undefined
  >(undefined);
  const [threadHandlers, setThreadHandlers] = useState<ThreadActionHandlers>({});
  const [threadData, setThreadDataState] = useState<Record<UUID, ThreadData>>({});
  const [getMessageActionState, setGetMessageActionState] = useState<
    (messageId: UUID) => MessageActionState | undefined
  >(() => () => undefined);
  const [scrollToMessage, setScrollToMessage] = useState<
    ((messageId: string) => void) | undefined
  >(undefined);

  const open = useCallback((intent: MessagesRightPanelIntent) => {
    setState({ isOpen: true, intent });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false, intent: null }));
  }, []);

  const toggle = useCallback((intent: MessagesRightPanelIntent) => {
    setState((prev) => {
      if (prev.isOpen && isSameIntent(prev.intent, intent)) {
        return { ...prev, isOpen: false, intent: null };
      }
      return { ...prev, isOpen: true, intent };
    });
  }, []);

  const toggleMessageFilter = useCallback((key: MessageFilterKey) => {
    setMessageFilter((prev) => (prev === key ? null : key));
  }, []);

  const isActive = useCallback(
    (key: MessagesRightPanelIntentKey, intent?: MessagesRightPanelIntent) => {
      if (!state.isOpen || !state.intent) return false;
      if (state.intent.key !== key) return false;
      if (intent) {
        return isSameIntent(state.intent, intent);
      }
      return true;
    },
    [state.intent, state.isOpen],
  );

  const setThreadData = useCallback(
    (
      thread: ThreadVM,
      data: { replies: ConnectionVM<MessageVM>; parentMessage?: MessageVM },
    ) => {
      setThreadDataState((prev) => ({
        ...prev,
        [thread.ids.id]: { thread, ...data },
      }));
    },
    [],
  );

  const appendThreadMessage = useCallback((threadId: UUID, message: MessageVM) => {
    setThreadDataState((prev) => {
      const existing = prev[threadId];
      if (!existing) return prev;
      return {
        ...prev,
        [threadId]: {
          ...existing,
          replies: {
            ...existing.replies,
            items: [...existing.replies.items, message],
            total:
              typeof existing.replies.total === 'number'
                ? existing.replies.total + 1
                : existing.replies.total,
          },
        },
      };
    });
  }, []);

  const getThreadData = useCallback(
    (threadId: UUID) => threadData[threadId],
    [threadData],
  );

  const setCreateTextMessageFactory = useCallback(
    (
      factory: (content: string, mentions?: MessageMentionVM[]) => TextMessageVM | null,
    ) => {
      setCreateTextMessage(() => factory);
    },
    [],
  );

  const setSendTextMessageFactory = useCallback((handler: SendTextMessageHandler) => {
    setSendTextMessage(() => handler);
  }, []);

  const setSendFileMessageFactory = useCallback((handler: SendFileMessageHandler) => {
    setSendFileMessage(() => handler);
  }, []);

  const setJoinLiveSessionFactory = useCallback(
    (handler: JoinLiveSessionHandler | undefined) => {
      setJoinLiveSession(() => handler);
    },
    [],
  );

  const setThreadHandlersFactory = useCallback((handlers: ThreadActionHandlers) => {
    setThreadHandlers(handlers);
  }, []);

  const setGetMessageActionStateFactory = useCallback(
    (handler: (messageId: UUID) => MessageActionState | undefined) => {
      setGetMessageActionState(() => handler);
    },
    [],
  );

  const value = useMemo(
    () => ({
      channel,
      isReadOnly,
      currentUserId,
      savedCount,
      homeworkCount,
      sessionSummaryCount,
      messages,
      messageFilter,
      showCreateMessageTypeButton,
      createTextMessage,
      sendTextMessage,
      sendFileMessage,
      joinLiveSession,
      threadHandlers,
      state,
      open,
      close,
      toggle,
      isActive,
      setCurrentUserId,
      setSavedCount,
      setHomeworkCount,
      setSessionSummaryCount,
      setMessages,
      setCreateTextMessage: setCreateTextMessageFactory,
      setSendTextMessage: setSendTextMessageFactory,
      setSendFileMessage: setSendFileMessageFactory,
      setJoinLiveSession: setJoinLiveSessionFactory,
      setThreadHandlers: setThreadHandlersFactory,
      toggleMessageFilter,
      appendThreadMessage,
      setThreadData,
      getThreadData,
      getMessageActionState,
      setGetMessageActionState: setGetMessageActionStateFactory,
      setScrollToMessage,
      scrollToMessage,
    }),
    [
      channel,
      isReadOnly,
      currentUserId,
      savedCount,
      homeworkCount,
      sessionSummaryCount,
      messages,
      messageFilter,
      showCreateMessageTypeButton,
      createTextMessage,
      sendTextMessage,
      sendFileMessage,
      joinLiveSession,
      threadHandlers,
      state,
      open,
      close,
      toggle,
      isActive,
      setCurrentUserId,
      setSavedCount,
      setHomeworkCount,
      setSessionSummaryCount,
      setMessages,
      setCreateTextMessageFactory,
      setSendTextMessageFactory,
      setSendFileMessageFactory,
      setJoinLiveSessionFactory,
      setThreadHandlersFactory,
      toggleMessageFilter,
      appendThreadMessage,
      setThreadData,
      getThreadData,
      getMessageActionState,
      setGetMessageActionStateFactory,
      setScrollToMessage,
      scrollToMessage,
    ],
  );

  return (
    <MessagesStateContext.Provider value={value}>
      {children}
    </MessagesStateContext.Provider>
  );
}

export function useMessagesState() {
  const context = useContext(MessagesStateContext);
  if (!context) {
    throw new Error('useMessagesState must be used within MessagesStateProvider');
  }
  return context;
}
