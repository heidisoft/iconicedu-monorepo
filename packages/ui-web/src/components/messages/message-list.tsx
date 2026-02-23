import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
  useState,
} from 'react';
import { MessageItem } from '@iconicedu/ui-web/components/messages/message-item';
import { EmptyMessagesState } from '@iconicedu/ui-web/components/messages/empty-state';
import type { ISODateTime, MessageVM, ThreadVM, UUID } from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { formatDateHeader } from '@iconicedu/ui-web/lib/message-utils';
import { findUnreadAnchorMessageId } from '@iconicedu/ui-web/components/messages/unread-indicator.utils';
import { findLatestIncomingMessageId } from '@iconicedu/ui-web/components/messages/read-state.utils';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { formatTime } from '@iconicedu/ui-web/lib/message-utils';

interface MessageListProps {
  messages: MessageVM[];
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void;
  onProfileClick: (userId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onToggleSaved?: (messageId: string) => void;
  onToggleHidden?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  currentUserId?: string;
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  initialScrollToBottom?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<boolean> | boolean;
  onUnreadViewed?: (lastReadMessageId: UUID) => void;
}

export interface MessageListRef {
  scrollToMessage: (messageId: string) => void;
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  (
    {
      messages,
      onOpenThread,
      onProfileClick,
      onToggleReaction,
      onToggleSaved,
      onToggleHidden,
      onDelete,
      currentUserId,
      lastReadMessageId,
      lastReadAt,
      initialScrollToBottom = false,
      hasMore = false,
      isLoadingMore = false,
      onLoadMore,
      onUnreadViewed,
    },
    ref,
  ) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollAreaRootRef = useRef<HTMLDivElement>(null);
    const isLoadingMoreRef = useRef(false);
    const didInitialScrollRef = useRef(false);
    const messageCountRef = useRef(messages.length);
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const isNearBottomRef = useRef(false);
    const lastNotifiedReadIdRef = useRef<UUID | null>(null);
    const [expandedThreadsByParent, setExpandedThreadsByParent] = useState<
      Record<UUID, boolean>
    >({});

    useImperativeHandle(ref, () => ({
      scrollToMessage: (messageId: string) => {
        const messageElement = messageRefs.current.get(messageId);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }
      },
    }));

    useEffect(() => {
      if (messages.length > messageCountRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      messageCountRef.current = messages.length;
    }, [messages]);

    useEffect(() => {
      if (!initialScrollToBottom || didInitialScrollRef.current) {
        return;
      }
      didInitialScrollRef.current = true;
      window.requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }, [initialScrollToBottom, messages.length]);

    useEffect(() => {
      isLoadingMoreRef.current = isLoadingMore;
    }, [isLoadingMore]);

    const sortedMessages = useMemo(
      () =>
        [...messages].sort(
          (a, b) =>
            new Date(a.core.createdAt).getTime() - new Date(b.core.createdAt).getTime(),
        ),
      [messages],
    );

    const unreadAnchorMessageId = useMemo(
      () =>
        findUnreadAnchorMessageId({
          sortedMessages,
          lastReadMessageId,
          lastReadAt,
          currentUserId,
        }),
      [sortedMessages, lastReadMessageId, lastReadAt, currentUserId],
    );
    const latestIncomingMessageId = useMemo(
      () => findLatestIncomingMessageId(sortedMessages, currentUserId),
      [sortedMessages, currentUserId],
    );

    const isViewportNearBottom = useCallback((viewport: HTMLDivElement | null) => {
      if (!viewport) {
        return false;
      }
      const remaining = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
      return remaining <= 40;
    }, []);

    const maybeMarkUnreadAsViewed = useCallback(() => {
      if (!onUnreadViewed || !unreadAnchorMessageId || !latestIncomingMessageId) {
        return;
      }
      if (!isNearBottomRef.current) {
        return;
      }
      if (typeof document !== 'undefined') {
        if (document.visibilityState !== 'visible') {
          return;
        }
        if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
          return;
        }
      }
      if (lastNotifiedReadIdRef.current === latestIncomingMessageId) {
        return;
      }
      lastNotifiedReadIdRef.current = latestIncomingMessageId;
      onUnreadViewed(latestIncomingMessageId);
    }, [latestIncomingMessageId, onUnreadViewed, unreadAnchorMessageId]);

    useEffect(() => {
      if (!unreadAnchorMessageId) {
        lastNotifiedReadIdRef.current = null;
      }
    }, [unreadAnchorMessageId]);

    useEffect(() => {
      const viewport = scrollAreaRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement | null;
      if (!viewport) {
        return;
      }
      isNearBottomRef.current = isViewportNearBottom(viewport);
      maybeMarkUnreadAsViewed();
    }, [messages.length, isViewportNearBottom, maybeMarkUnreadAsViewed]);

    useEffect(() => {
      const root = scrollAreaRootRef.current;
      if (!root || !onLoadMore || !hasMore) {
        return;
      }
      const viewport = root.querySelector('[data-slot="scroll-area-viewport"]') as
        | HTMLDivElement
        | null;
      if (!viewport) {
        return;
      }

      const maybeLoadMore = async () => {
        isNearBottomRef.current = isViewportNearBottom(viewport);
        maybeMarkUnreadAsViewed();
        if (viewport.scrollTop > 40 || isLoadingMoreRef.current) {
          return;
        }
        const previousHeight = viewport.scrollHeight;
        const previousTop = viewport.scrollTop;
        isLoadingMoreRef.current = true;
        const loaded = await onLoadMore();
        window.requestAnimationFrame(() => {
          if (!loaded) {
            isLoadingMoreRef.current = false;
            return;
          }
          const nextHeight = viewport.scrollHeight;
          viewport.scrollTop = previousTop + (nextHeight - previousHeight);
          isLoadingMoreRef.current = false;
        });
      };

      const onScroll = () => {
        void maybeLoadMore();
      };
      viewport.addEventListener('scroll', onScroll);
      return () => {
        viewport.removeEventListener('scroll', onScroll);
      };
    }, [hasMore, onLoadMore, isViewportNearBottom, maybeMarkUnreadAsViewed]);

    useEffect(() => {
      const viewport = scrollAreaRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement | null;
      if (!viewport) {
        return;
      }
      const handleWindowStateChange = () => {
        isNearBottomRef.current = isViewportNearBottom(viewport);
        maybeMarkUnreadAsViewed();
      };
      window.addEventListener('focus', handleWindowStateChange);
      document.addEventListener('visibilitychange', handleWindowStateChange);
      return () => {
        window.removeEventListener('focus', handleWindowStateChange);
        document.removeEventListener('visibilitychange', handleWindowStateChange);
      };
    }, [isViewportNearBottom, maybeMarkUnreadAsViewed]);

    const groupedMessages = useMemo(() => {
      const groups: { date: string; messages: MessageVM[] }[] = [];
      let currentDate = '';

      sortedMessages.forEach((message) => {
        const messageDate = formatDateHeader(message.core.createdAt);
        if (messageDate !== currentDate) {
          currentDate = messageDate;
          groups.push({ date: messageDate, messages: [message] });
        } else {
          groups[groups.length - 1].messages.push(message);
        }
      });

      return groups;
    }, [sortedMessages]);

    const threadRepliesByParent = useMemo(() => {
      const replies = new Map<UUID, MessageVM[]>();
      sortedMessages.forEach((candidate) => {
        const thread = candidate.social.thread;
        if (!thread) return;
        const parentId = thread.parent.messageId;
        if (!parentId || candidate.ids.id === parentId) return;
        const existing = replies.get(parentId) ?? [];
        existing.push(candidate);
        replies.set(parentId, existing);
      });
      return replies;
    }, [sortedMessages]);

    const getInlineReplyPreview = useCallback((message: MessageVM) => {
      if ('content' in message && message.content && 'text' in message.content) {
        const value = message.content.text;
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
      }
      return 'Shared an update';
    }, []);

    const handleThreadIndicatorClick = useCallback(
      (thread: ThreadVM, parentMessage: MessageVM) => {
        const parentId = thread.parent.messageId ?? parentMessage.ids.id;
        if ((threadRepliesByParent.get(parentId)?.length ?? 0) === 0) {
          onOpenThread(thread, parentMessage);
          return;
        }
        setExpandedThreadsByParent((prev) => ({
          ...prev,
          [parentId]: !prev[parentId],
        }));
      },
      [onOpenThread, threadRepliesByParent],
    );

    return (
      <ScrollArea ref={scrollAreaRootRef} className="flex-1 min-h-0">
        {isLoadingMore ? (
          <div className="sticky top-0 z-10 flex justify-center py-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground animate-pulse">
              Loading messages...
            </span>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="flex min-h-[70vh] w-full items-center justify-center">
            <EmptyMessagesState
              title="No messages yet"
              description="Looks like you have not started a conversation yet."
            />
          </div>
        ) : null}
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="relative my-4 flex items-center">
              <div className="flex-1 border-t border-border" />
              <span className="mx-4 text-xs font-medium text-muted-foreground bg-background px-2">
                {group.date}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
            {group.messages.map((message) => {
              const showUnreadDivider =
                unreadAnchorMessageId !== null && message.ids.id === unreadAnchorMessageId;
              return (
                <div
                  key={message.ids.id}
                  ref={(el) => {
                    if (el) messageRefs.current.set(message.ids.id, el);
                    else messageRefs.current.delete(message.ids.id);
                  }}
                  className="transition-all duration-300"
                >
                  {showUnreadDivider && (
                    <div className="relative my-4 flex items-center">
                      <div className="flex-1 border-t border-yellow-200" />
                      <span className="mx-4 text-xs font-medium text-yellow-700 bg-background px-2">
                        NEW MESSAGES
                      </span>
                      <div className="flex-1 border-t border-yellow-200" />
                    </div>
                  )}
                  <MessageItem
                    message={message}
                    onOpenThread={handleThreadIndicatorClick}
                    isThreadReply={
                      Boolean(message.social.thread) &&
                      message.social.thread?.parent.messageId !== message.ids.id
                    }
                    onProfileClick={onProfileClick}
                    onToggleReaction={onToggleReaction}
                    onToggleSaved={onToggleSaved}
                    onToggleHidden={onToggleHidden}
                    onDelete={onDelete}
                    currentUserId={currentUserId}
                  />
                  {message.social.thread &&
                    expandedThreadsByParent[message.ids.id] &&
                    (threadRepliesByParent.get(message.ids.id)?.length ?? 0) > 0 && (
                      <div className="pl-10 pr-2 pb-2">
                        <div className="ml-4 border-l-2 border-border/70 pl-5 space-y-3">
                          {(threadRepliesByParent.get(message.ids.id) ?? []).map((reply) => {
                            const senderName = getProfileDisplayName(reply.core.sender.profile);
                            return (
                              <div key={reply.ids.id} className="flex items-start gap-3">
                                <AvatarWithStatus
                                  name={senderName}
                                  avatar={reply.core.sender.profile.avatar}
                                  themeKey={reply.core.sender.ui?.themeKey}
                                  showStatus={false}
                                  sizeClassName="h-8 w-8"
                                  fallbackClassName="text-sm"
                                  initialsLength={1}
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">
                                      {senderName}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {formatTime(reply.core.createdAt)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-base leading-snug text-foreground/90 break-words">
                                    {getInlineReplyPreview(reply)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </ScrollArea>
    );
  },
);

MessageList.displayName = 'MessageList';
