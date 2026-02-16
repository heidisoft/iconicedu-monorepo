'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageList, type MessageListRef } from '@iconicedu/ui-web/components/messages/message-list';
import { MessageInput } from '@iconicedu/ui-web/components/messages/message-input';
import { TypingIndicator } from '@iconicedu/ui-web/components/messages/typing-indicator';
import { useMessages } from '@iconicedu/ui-web/hooks/use-messages';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import type {
  ChannelVM,
  EducatorProfileVM,
  GuardianProfileVM,
  ISODateTime,
  MessageVM,
  MessagesRealtimeClient,
  MessageWriteClient,
  TextMessageVM,
  ThreadVM,
  UUID,
  UserProfileVM,
} from '@iconicedu/shared-types';

export interface MessagesContainerProps {
  channel: ChannelVM;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  realtimeClient?: MessagesRealtimeClient | null;
  messageWriteClient?: MessageWriteClient | null;
}

const isGuardianProfile = (profile: UserProfileVM): profile is GuardianProfileVM =>
  profile.kind === 'guardian';

const isEducatorProfile = (profile: UserProfileVM): profile is EducatorProfileVM =>
  profile.kind === 'educator';

const MESSAGES_PAGE_SIZE = 40;

export function MessagesContainer({
  channel,
  currentUserId: currentUserIdProp,
  currentUserProfile,
  realtimeClient,
  messageWriteClient,
}: MessagesContainerProps) {
  const messageListRef = useRef<MessageListRef>(null);
  const messagesRef = useRef<MessageVM[]>([]);
  const typingTimeoutsRef = useRef(new Map<string, number>());
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set());
  const {
    toggle,
    setSavedCount,
    setHomeworkCount,
    setSessionSummaryCount,
    setThreadData,
    setCurrentUserId,
    setMessages,
    setCreateTextMessage,
    setSendTextMessage,
    setThreadHandlers,
    setScrollToMessage,
    messageFilter,
    toggleMessageFilter,
  } = useMessagesState();
  const channelMessages = useMemo(
    () => channel.collections.messages?.items ?? [],
    [channel.collections.messages],
  );
  const {
    messages,
    addMessage,
    prependMessages,
    updateMessage,
    deleteMessage,
    toggleReaction,
    toggleSaved,
    toggleHidden,
  } = useMessages(channelMessages);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(
    channelMessages.length >= MESSAGES_PAGE_SIZE,
  );
  const [oldestCursor, setOldestCursor] = useState<string | null>(
    channelMessages[0]?.core.createdAt ?? null,
  );
  const [activitySignal, setActivitySignal] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState<UUID | undefined>(
    channel.collections.readState?.lastReadMessageId,
  );
  const [lastReadAt, setLastReadAt] = useState<ISODateTime | undefined>(
    channel.collections.readState?.lastReadAt,
  );

  const participants = useMemo(
    () => channel.collections.participants ?? [],
    [channel.collections.participants],
  );
  const fallbackParticipant = participants[0];
  const guardian = participants.find(isGuardianProfile) ?? fallbackParticipant;
  const educator =
    participants.find(isEducatorProfile) ??
    participants.find((participant) => participant.ids.id !== guardian?.ids.id) ??
    fallbackParticipant;
  const resolvedCurrentUserId =
    currentUserIdProp ??
    currentUserProfile?.ids.id ??
    guardian?.ids.id ??
    participants[0]?.ids.id ??
    '';
  const resolvedCurrentUserProfile =
    currentUserProfile ??
    participants.find((participant) => participant.ids.id === resolvedCurrentUserId) ??
    null;
  const senderProfile =
    resolvedCurrentUserProfile ?? guardian ?? educator ?? fallbackParticipant;
  const currentUserId = resolvedCurrentUserId;
  const typingParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          typingIds.has(participant.ids.id) && participant.ids.id !== currentUserId,
      ),
    [participants, typingIds, currentUserId],
  );

  const upsertTypingProfile = useCallback((profileId: string, isTyping: boolean) => {
    setTypingIds((prev) => {
      const next = new Set(prev);
      if (isTyping) {
        next.add(profileId);
      } else {
        next.delete(profileId);
      }
      return next;
    });
  }, []);

  const clearTypingTimeout = useCallback((profileId: string) => {
    const existing = typingTimeoutsRef.current.get(profileId);
    if (existing) {
      window.clearTimeout(existing);
      typingTimeoutsRef.current.delete(profileId);
    }
  }, []);

  const registerUserActivity = useCallback(() => {
    setActivitySignal((prev) => prev + 1);
  }, []);

  const markChannelRead = useCallback(
    (nextLastReadMessageId: UUID) => {
      if (!nextLastReadMessageId || !channel.ids.id) {
        return;
      }
      if (lastReadMessageId === nextLastReadMessageId) {
        return;
      }

      const nextLastReadAt = new Date().toISOString();
      setLastReadMessageId(nextLastReadMessageId);
      setLastReadAt(nextLastReadAt);
      window.dispatchEvent(
        new CustomEvent('dm:mark-read', {
          detail: {
            channelId: channel.ids.id,
            lastReadMessageId: nextLastReadMessageId,
            lastReadAt: nextLastReadAt,
          },
        }),
      );

      const persistReadState = async () => {
        try {
          await window.fetch('/d/messages/actions/read-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId: channel.ids.id,
              lastReadMessageId: nextLastReadMessageId,
            }),
          });
        } catch {
          // best effort client sync
        }
      };
      void persistReadState();
    },
    [channel.ids.id, lastReadMessageId],
  );

  const handleOpenThread = useCallback(
    (thread: ThreadVM, parentMessage: MessageVM) => {
      const threadMessages = messages
        .filter((message) => message.social.thread?.ids.id === thread.ids.id)
        .sort(
          (a, b) =>
            new Date(a.core.createdAt).getTime() - new Date(b.core.createdAt).getTime(),
        );
      const resolvedThreadMessages = threadMessages.length
        ? threadMessages
        : [parentMessage];
      const replyItems = resolvedThreadMessages.filter(
        (message) => message.ids.id !== parentMessage.ids.id,
      );
      setThreadData(thread, {
        replies: {
          items: replyItems,
          total:
            typeof thread.stats?.messageCount === 'number'
              ? Math.max(0, thread.stats.messageCount - 1)
              : undefined,
        },
        parentMessage,
      });
      toggle({ key: 'thread', threadId: thread.ids.id });
    },
    [messages, setThreadData, toggle],
  );

  const syncParentThreadFromReply = useCallback(
    (message: MessageVM) => {
      const thread = message.social.thread;
      const parentMessageId = thread?.parent.messageId;
      if (!thread || !parentMessageId || parentMessageId === message.ids.id) {
        return;
      }
      updateMessage(parentMessageId, {
        social: { thread } as MessageVM['social'],
      });
    },
    [updateMessage],
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!senderProfile) return;
      if (messageFilter) {
        toggleMessageFilter(messageFilter);
      }
      const sendMessage = async () => {
        if (messageWriteClient && currentUserId) {
          const created = await messageWriteClient.sendTextMessage({
            orgId: channel.ids.orgId,
            channelId: channel.ids.id,
            senderProfileId: currentUserId,
            content,
          });
          const exists = messagesRef.current.some(
            (message) => message.ids.id === created.ids.id,
          );
          if (!exists) {
            addMessage(created);
          }
          return;
        }
        const newMessage: TextMessageVM = {
          ids: { id: `msg-${Date.now()}`, orgId: channel.ids.orgId },
          core: {
            type: 'text',
            sender: senderProfile,
            createdAt: new Date().toISOString(),
            visibility: { type: 'all' },
          },
          social: {
            reactions: [],
          },
          state: {
            isSaved: false,
          },
          content: { text: content },
        };
        addMessage(newMessage);
      };
      void sendMessage();
    },
    [
      addMessage,
      senderProfile,
      messageFilter,
      toggleMessageFilter,
      channel.ids.orgId,
      channel.ids.id,
      messageWriteClient,
      currentUserId,
    ],
  );

  const handleProfileClick = useCallback(
    (userId: string) => {
      toggle({ key: 'profile', userId });
    },
    [toggle],
  );

  const handleTypingStart = useCallback(() => {
    if (!realtimeClient || !currentUserId) return;
    realtimeClient.sendTyping?.({
      orgId: channel.ids.orgId,
      channelId: channel.ids.id,
      profileId: currentUserId,
      isTyping: true,
    });
  }, [
    realtimeClient,
    currentUserId,
    channel.ids.orgId,
    channel.ids.id,
  ]);

  const handleInputFocus = useCallback(() => {
    registerUserActivity();
  }, [registerUserActivity]);

  const handleInputKeyDown = useCallback(() => {
    registerUserActivity();
  }, [registerUserActivity]);

  const handleTypingStop = useCallback(() => {
    if (!realtimeClient || !currentUserId) return;
    realtimeClient.sendTyping?.({
      orgId: channel.ids.orgId,
      channelId: channel.ids.id,
      profileId: currentUserId,
      isTyping: false,
    });
  }, [realtimeClient, currentUserId, channel.ids.orgId, channel.ids.id]);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!currentUserId) return;
      toggleReaction(messageId, emoji, currentUserId);
      if (messageWriteClient) {
        const persistReaction = async () => {
          try {
            await messageWriteClient.toggleReaction({
              orgId: channel.ids.orgId,
              messageId,
              emoji,
            });
          } catch {
            toggleReaction(messageId, emoji, currentUserId);
          }
        };
        void persistReaction();
      }
    },
    [toggleReaction, currentUserId, messageWriteClient, channel.ids.orgId],
  );

  const handleToggleSaved = useCallback(
    (messageId: string) => {
      toggleSaved(messageId);
    },
    [toggleSaved],
  );

  const handleToggleHidden = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.ids.id === messageId);
      if (!message) return;

      const newHiddenState = !message.state?.isHidden;

      if (messageWriteClient) {
        try {
          await messageWriteClient.toggleHiddenMessage({
            orgId: channel.ids.orgId,
            messageId,
            isHidden: newHiddenState,
          });
          // Update local state immediately for better UX
          toggleHidden(messageId);
          // Broadcast to all other clients via realtime
          if (realtimeClient?.broadcastMessageUpdated) {
            await realtimeClient.broadcastMessageUpdated({
              channelId: channel.ids.id,
              messageId,
            });
          }
        } catch (error) {
          console.error('Failed to toggle hidden message:', error);
          return;
        }
      }
    },
    [messageWriteClient, channel.ids.orgId, channel.ids.id, realtimeClient, messages, toggleHidden],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (messageWriteClient) {
        try {
          await messageWriteClient.deleteMessage({
            orgId: channel.ids.orgId,
            messageId,
          });
          // Update local state immediately for better UX
          deleteMessage(messageId);
          // Broadcast to all other clients via realtime
          if (realtimeClient?.broadcastMessageDeleted) {
            await realtimeClient.broadcastMessageDeleted({
              channelId: channel.ids.id,
              messageId,
            });
          }
        } catch (error) {
          console.error('Failed to delete message:', error);
          return;
        }
      }
    },
    [messageWriteClient, channel.ids.orgId, channel.ids.id, realtimeClient, deleteMessage],
  );

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !message.social.thread?.parent?.messageId ||
          message.social.thread.parent.messageId === message.ids.id,
      ),
    [messages],
  );

  const savedCount = useMemo(
    () => messages.filter((m) => m.state?.isSaved).length,
    [messages],
  );
  const homeworkCount = useMemo(
    () =>
      visibleMessages.filter(
        (message) =>
          message.core.type === 'lesson-assignment' ||
          message.core.type === 'homework-submission',
      ).length,
    [visibleMessages],
  );
  const sessionSummaryCount = useMemo(
    () =>
      visibleMessages.filter((message) => message.core.type === 'session-summary')
        .length,
    [visibleMessages],
  );

  const filteredMessages = useMemo(() => {
    if (!messageFilter) return visibleMessages;
    if (messageFilter === 'homework') {
      return visibleMessages.filter(
        (message) =>
          message.core.type === 'lesson-assignment' ||
          message.core.type === 'homework-submission',
      );
    }
    if (messageFilter === 'session-summary') {
      return visibleMessages.filter(
        (message) => message.core.type === 'session-summary',
      );
    }
    return visibleMessages;
  }, [messageFilter, visibleMessages]);

  useEffect(() => {
    setSavedCount(savedCount);
  }, [savedCount, setSavedCount]);

  useEffect(() => {
    setHomeworkCount(homeworkCount);
    setSessionSummaryCount(sessionSummaryCount);
  }, [homeworkCount, sessionSummaryCount, setHomeworkCount, setSessionSummaryCount]);

  useEffect(() => {
    if (currentUserId) {
      setCurrentUserId(currentUserId);
    }
  }, [currentUserId, setCurrentUserId]);

  useEffect(() => {
    setMessages(messages);
  }, [messages, setMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setHasMoreOlderMessages(channelMessages.length >= MESSAGES_PAGE_SIZE);
    setOldestCursor(channelMessages[0]?.core.createdAt ?? null);
  }, [channel.ids.id, channelMessages]);

  useEffect(() => {
    setLastReadMessageId(channel.collections.readState?.lastReadMessageId);
  }, [channel.ids.id, channel.collections.readState?.lastReadMessageId]);
  useEffect(() => {
    setLastReadAt(channel.collections.readState?.lastReadAt);
  }, [channel.ids.id, channel.collections.readState?.lastReadAt]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreOlderMessages || !oldestCursor) {
      return false;
    }
    setIsLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        channelId: channel.ids.id,
        before: oldestCursor,
        limit: String(MESSAGES_PAGE_SIZE),
      });
      const response = await window.fetch(
        `/d/messages/actions/channel-page?${params.toString()}`,
      );
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as {
        success?: boolean;
        messages?: MessageVM[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };
      if (!payload.success || !payload.messages?.length) {
        setHasMoreOlderMessages(Boolean(payload.hasMore));
        if (payload.nextCursor !== undefined) {
          setOldestCursor(payload.nextCursor);
        }
        return false;
      }
      prependMessages(payload.messages);
      setHasMoreOlderMessages(Boolean(payload.hasMore));
      setOldestCursor(payload.nextCursor ?? payload.messages[0]?.core.createdAt ?? null);
      return true;
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    channel.ids.id,
    hasMoreOlderMessages,
    isLoadingOlder,
    oldestCursor,
    prependMessages,
  ]);

  useEffect(() => {
    const typingTimeouts = typingTimeoutsRef.current;
    return () => {
      typingTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      typingTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!realtimeClient) return;
    let isActive = true;
    let cleanup: (() => void) | undefined;

    const subscribe = async () => {
      const result = await realtimeClient.subscribe({
        orgId: channel.ids.orgId,
        channelId: channel.ids.id,
        onEvent: (event) => {
          if (!isActive) return;
          if (event.type === 'message-added') {
            const exists = messagesRef.current.some(
              (message) => message.ids.id === event.message.ids.id,
            );
            if (exists) {
              updateMessage(event.message.ids.id, event.message);
              syncParentThreadFromReply(event.message);
              return;
            }
            addMessage(event.message);
            syncParentThreadFromReply(event.message);
          }
          if (event.type === 'message-updated') {
            updateMessage(event.message.ids.id, event.message);
            syncParentThreadFromReply(event.message);
          }
          if (event.type === 'message-deleted') {
            deleteMessage(event.messageId);
          }
          if (event.type === 'typing-start') {
            if (event.profileId === currentUserId) return;
            upsertTypingProfile(event.profileId, true);
            clearTypingTimeout(event.profileId);
            const timeoutId = window.setTimeout(() => {
              upsertTypingProfile(event.profileId, false);
              typingTimeoutsRef.current.delete(event.profileId);
            }, 2600);
            typingTimeoutsRef.current.set(event.profileId, timeoutId);
          }
          if (event.type === 'typing-stop') {
            clearTypingTimeout(event.profileId);
            upsertTypingProfile(event.profileId, false);
          }
        },
      });

      if (typeof result === 'function') {
        cleanup = result;
        return;
      }
      if (result && typeof result.unsubscribe === 'function') {
        cleanup = () => result.unsubscribe();
      }
    };

    void subscribe();

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [
    realtimeClient,
    channel.ids.orgId,
    channel.ids.id,
    addMessage,
    updateMessage,
    syncParentThreadFromReply,
    deleteMessage,
    currentUserId,
    upsertTypingProfile,
    clearTypingTimeout,
  ]);

  useEffect(() => {
    if (!senderProfile) return;
    setCreateTextMessage(
      (content: string): TextMessageVM => ({
        ids: { id: `reply-${Date.now()}`, orgId: channel.ids.orgId },
        core: {
          type: 'text',
          sender: senderProfile,
          createdAt: new Date().toISOString(),
          visibility: { type: 'all' },
        },
        social: {
          reactions: [],
        },
        state: {
          isSaved: false,
        },
        content: { text: content },
      }),
    );
  }, [senderProfile, setCreateTextMessage, channel.ids.orgId]);

  useEffect(() => {
    if (!senderProfile) return;
    setSendTextMessage(async ({ content, threadId, threadParentId }) => {
      if (messageWriteClient && currentUserId) {
        const created = await messageWriteClient.sendTextMessage({
          orgId: channel.ids.orgId,
          channelId: channel.ids.id,
          senderProfileId: currentUserId,
          content,
          threadId,
          threadParentId,
        });
        const exists = messagesRef.current.some(
          (message) => message.ids.id === created.ids.id,
        );
        if (!exists) {
          addMessage(created);
        }
        return created;
      }
      return {
        ids: { id: `reply-${Date.now()}`, orgId: channel.ids.orgId },
        core: {
          type: 'text',
          sender: senderProfile,
          createdAt: new Date().toISOString(),
          visibility: { type: 'all' },
        },
        social: {
          reactions: [],
        },
        state: {
          isSaved: false,
        },
        content: { text: content },
      };
    });
  }, [
    senderProfile,
    setSendTextMessage,
    channel.ids.orgId,
    channel.ids.id,
    messageWriteClient,
    currentUserId,
    addMessage,
  ]);

  useEffect(() => {
    setThreadHandlers({
      onAddMessage: addMessage,
      onUpdateMessage: updateMessage,
      onDeleteMessage: handleDeleteMessage,
      onToggleReaction: handleToggleReaction,
      onToggleSaved: handleToggleSaved,
      onToggleHidden: handleToggleHidden,
    });
  }, [
    addMessage,
    updateMessage,
    handleDeleteMessage,
    handleToggleReaction,
    handleToggleSaved,
    handleToggleHidden,
    setThreadHandlers,
  ]);

  useEffect(() => {
    setScrollToMessage(() => (messageId: string) => {
      messageListRef.current?.scrollToMessage(messageId);
    });
  }, [setScrollToMessage]);

  const messageListProps = useMemo(
    () => ({
      messages: filteredMessages,
      onOpenThread: handleOpenThread,
      onProfileClick: handleProfileClick,
      onToggleReaction: handleToggleReaction,
      onToggleSaved: handleToggleSaved,
      onToggleHidden: handleToggleHidden,
      onDelete: handleDeleteMessage,
      currentUserId,
      lastReadMessageId,
      lastReadAt,
      hasMore: hasMoreOlderMessages,
      isLoadingMore: isLoadingOlder,
      onLoadMore: handleLoadOlderMessages,
      initialScrollToBottom: true,
      activitySignal,
      onUnreadViewed: markChannelRead,
    }),
    [
      filteredMessages,
      handleOpenThread,
      handleProfileClick,
      handleToggleReaction,
      handleToggleSaved,
      handleToggleHidden,
      handleDeleteMessage,
      currentUserId,
      lastReadMessageId,
      lastReadAt,
      hasMoreOlderMessages,
      isLoadingOlder,
      handleLoadOlderMessages,
      activitySignal,
      markChannelRead,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 min-w-0 flex-col">
      <MessageList
        ref={messageListRef}
        {...messageListProps}
      />
      {typingParticipants.length ? (
        <TypingIndicator profiles={typingParticipants} className="border-t border-border" />
      ) : null}
      <MessageInput
        onSend={handleSendMessage}
        placeholder={`Message ${getProfileDisplayName(
          educator?.profile,
          channel.basics.topic ?? 'User',
        )}`}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        onFocus={handleInputFocus}
        onInputKeyDown={handleInputKeyDown}
      />
    </div>
  );
}
