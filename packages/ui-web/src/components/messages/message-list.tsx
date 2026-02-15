import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import { MessageItem } from '@iconicedu/ui-web/components/messages/message-item';
import { EmptyMessagesState } from '@iconicedu/ui-web/components/messages/empty-state';
import type { ISODateTime, MessageVM, ThreadVM, UUID } from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { formatDateHeader } from '@iconicedu/ui-web/lib/message-utils';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { findUnreadAnchorMessageId } from '@iconicedu/ui-web/components/messages/unread-indicator.utils';
import { useUnreadIndicator } from '@iconicedu/ui-web/components/messages/hooks/use-unread-indicator';
import { findLatestIncomingMessageId } from '@iconicedu/ui-web/components/messages/read-state.utils';

interface MessageListProps {
  messages: MessageVM[];
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void;
  onProfileClick: (userId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onToggleSaved?: (messageId: string) => void;
  onToggleHidden?: (messageId: string) => void;
  currentUserId?: string;
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  initialScrollToBottom?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<boolean> | boolean;
  activitySignal?: number;
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
      currentUserId,
      lastReadMessageId,
      lastReadAt,
      initialScrollToBottom = false,
      hasMore = false,
      isLoadingMore = false,
      onLoadMore,
      activitySignal = 0,
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

    useImperativeHandle(ref, () => ({
      scrollToMessage: (messageId: string) => {
        const messageElement = messageRefs.current.get(messageId);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          // eslint-disable-next-line no-undef
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
    const {
      dismissedUnreadAnchorId,
      isUnreadDividerDismissing,
      dismissUnreadDivider,
    } = useUnreadIndicator({
      unreadAnchorMessageId,
      latestIncomingMessageId,
      onUnreadViewed,
    });

    useEffect(() => {
      if (!activitySignal) {
        return;
      }
      dismissUnreadDivider();
    }, [activitySignal, dismissUnreadDivider]);

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
    }, [hasMore, onLoadMore]);

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
                unreadAnchorMessageId !== null &&
                dismissedUnreadAnchorId !== unreadAnchorMessageId &&
                message.ids.id === unreadAnchorMessageId;
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
                    <div
                      className={cn(
                        'relative my-4 flex items-center transition-all duration-900 ease-out',
                        isUnreadDividerDismissing
                          ? 'opacity-0 -translate-y-1'
                          : 'opacity-100 translate-y-0',
                      )}
                    >
                      <div className="flex-1 border-t border-amber-300" />
                      <span className="mx-4 text-xs font-medium text-amber-700 bg-background px-2">
                        NEW MESSAGES
                      </span>
                      <div className="flex-1 border-t border-amber-300" />
                    </div>
                  )}
                  <MessageItem
                    message={message}
                    onOpenThread={onOpenThread}
                    onProfileClick={onProfileClick}
                    onToggleReaction={onToggleReaction}
                    onToggleSaved={onToggleSaved}
                    onToggleHidden={onToggleHidden}
                    currentUserId={currentUserId}
                  />
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
