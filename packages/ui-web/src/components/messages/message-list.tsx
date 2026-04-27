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
import { ReactionBar } from '@iconicedu/ui-web/components/messages/shared/reaction-bar';
import type {
  ISODateTime,
  MessageUiThemeKeyVM,
  MessageVM,
  ThreadVM,
  UserProfileVM,
  UUID,
} from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { formatDateHeader, formatTime } from '@iconicedu/ui-web/lib/message-utils';
import {
  findLatestUnreadIncomingMessageId,
  findUnreadAnchorMessageId,
} from '@iconicedu/ui-web/components/messages/unread-indicator.utils';
import {
  AvatarWithStatus,
  getAvatarLocationLabel,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { EmojiPicker } from '@iconicedu/ui-web/components/messages/emoji-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import {
  Bookmark,
  Copy,
  EyeOff,
  Forward,
  Loader2,
  MessageCircleReply,
  MoreHorizontal,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import {
  buildThreadRepliesByParent,
  getInlineReplyPreview,
} from '@iconicedu/ui-web/components/messages/message-list.inline-thread.utils';
import { shouldHideMessageQuickActions } from '@iconicedu/ui-web/components/messages/message-action-visibility.utils';
import type { MessageActionState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { useUnreadIndicator } from '@iconicedu/ui-web/components/messages/hooks/use-unread-indicator';
import { UnreadDivider } from '@iconicedu/ui-web/components/messages/shared/unread-divider';

interface MessageListProps {
  messages: MessageVM[];
  emptyStateTitle?: string;
  emptyStateDescription?: React.ReactNode;
  emptyStateIcon?: React.ReactNode;
  emptyStateStarterAction?: {
    label: string;
    onClick: () => void;
  };
  threadMessagesSource?: MessageVM[];
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void | Promise<void>;
  onSendThreadReply?: (
    parentMessage: MessageVM,
    thread: ThreadVM,
    content: string,
  ) => Promise<void> | void;
  onProfileClick: (userId: string) => void;
  onToggleReaction?: (
    messageId: string,
    emoji: string,
    source?: 'bar' | 'picker',
  ) => void;
  onToggleSaved?: (messageId: string) => void;
  onToggleHidden?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  getMessageActionState?: (messageId: string) => MessageActionState | undefined;
  currentUserId?: string;
  currentUserProfile?: UserProfileVM | null;
  currentUserCanDeleteAnyMessages?: boolean;
  isReadOnly?: boolean;
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  initialScrollToBottom?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<boolean> | boolean;
  onUnreadViewed?: (lastReadMessageId: UUID) => void;
  messageUiThemeKey?: MessageUiThemeKeyVM;
}

export interface MessageListRef {
  scrollToMessage: (messageId: string) => void;
}

function findInlineUnreadStartIndex(input: {
  replies: MessageVM[];
  lastReadMessageId?: UUID;
  unreadCount?: number;
  currentUserId?: UUID;
}): number {
  const { replies, lastReadMessageId, unreadCount, currentUserId } = input;
  const normalizedUnreadCount = Math.max(0, unreadCount ?? 0);
  if (replies.length === 0) {
    return -1;
  }

  const findIncomingIndex = (startIndex: number): number => {
    for (let index = startIndex; index < replies.length; index += 1) {
      const reply = replies[index];
      if (!currentUserId || reply.core.sender.ids.id !== currentUserId) {
        return index;
      }
    }
    return -1;
  };

  if (lastReadMessageId) {
    const lastReadIndex = replies.findIndex(
      (reply) => reply.ids.id === lastReadMessageId,
    );
    if (lastReadIndex >= 0) {
      return findIncomingIndex(lastReadIndex + 1);
    }
  }

  if (normalizedUnreadCount <= 0) {
    return -1;
  }

  const fallbackStartIndex = Math.max(0, replies.length - normalizedUnreadCount);
  return findIncomingIndex(fallbackStartIndex);
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  (
    {
      messages,
      emptyStateTitle = 'No messages yet',
      emptyStateDescription = 'Looks like you have not started a conversation yet.',
      emptyStateIcon,
      emptyStateStarterAction,
      threadMessagesSource,
      onOpenThread,
      onSendThreadReply,
      onProfileClick,
      onToggleReaction,
      onToggleSaved,
      onToggleHidden,
      onDelete,
      getMessageActionState,
      currentUserId,
      currentUserProfile,
      currentUserCanDeleteAnyMessages = false,
      isReadOnly = false,
      lastReadMessageId,
      lastReadAt,
      initialScrollToBottom = false,
      hasMore = false,
      isLoadingMore = false,
      onLoadMore,
      onUnreadViewed,
      messageUiThemeKey = 'classic',
    },
    ref,
  ) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollAreaRootRef = useRef<HTMLDivElement>(null);
    const isLoadingMoreRef = useRef(false);
    const didInitialScrollRef = useRef(false);
    const latestMessageIdRef = useRef<string | undefined>(
      messages[messages.length - 1]?.ids.id,
    );
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const isNearBottomRef = useRef(false);
    const lastNotifiedReadIdRef = useRef<UUID | null>(null);
    const pendingInlineReplyScrollParentRef = useRef<UUID | null>(null);
    const [expandedThreadsByParent, setExpandedThreadsByParent] = useState<
      Record<UUID, boolean>
    >({});
    const [openedThreadByParent, setOpenedThreadByParent] = useState<
      Record<UUID, ThreadVM>
    >({});
    const [draftByParent, setDraftByParent] = useState<Record<UUID, string>>({});
    const [loadingThreadsByParent, setLoadingThreadsByParent] = useState<
      Record<UUID, boolean>
    >({});
    const [sendingReplyByParent, setSendingReplyByParent] = useState<
      Record<UUID, boolean>
    >({});
    const currentUserComposerProfile = useMemo(() => {
      if (currentUserProfile) return currentUserProfile;
      if (!currentUserId) return null;
      return (
        [...messages, ...(threadMessagesSource ?? [])].find(
          (message) => message.core.sender.ids.id === currentUserId,
        )?.core.sender ?? null
      );
    }, [currentUserId, currentUserProfile, messages, threadMessagesSource]);
    const currentUserComposerName = currentUserComposerProfile
      ? getProfileDisplayName(currentUserComposerProfile.profile)
      : 'You';

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
      const latestMessageId = messages[messages.length - 1]?.ids.id;
      if (latestMessageId && latestMessageId !== latestMessageIdRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      latestMessageIdRef.current = latestMessageId;
    }, [messages]);

    useEffect(() => {
      if (
        !initialScrollToBottom ||
        didInitialScrollRef.current ||
        messages.length === 0
      ) {
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

    const sortedThreadSourceMessages = useMemo(
      () =>
        [...(threadMessagesSource ?? messages)].sort(
          (a, b) =>
            new Date(a.core.createdAt).getTime() - new Date(b.core.createdAt).getTime(),
        ),
      [messages, threadMessagesSource],
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
    const latestUnreadIncomingMessageId = useMemo(
      () =>
        findLatestUnreadIncomingMessageId({
          sortedMessages,
          lastReadMessageId,
          lastReadAt,
          currentUserId,
        }),
      [sortedMessages, lastReadMessageId, lastReadAt, currentUserId],
    );
    const { dismissedUnreadAnchorId, isUnreadDividerDismissing, dismissUnreadDivider } =
      useUnreadIndicator({ unreadAnchorMessageId });

    const isViewportNearBottom = useCallback((viewport: HTMLDivElement | null) => {
      if (!viewport) {
        return false;
      }
      const remaining =
        viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
      return remaining <= 40;
    }, []);

    const maybeMarkVisibleIncomingAsViewed = useCallback(() => {
      if (!onUnreadViewed || !latestUnreadIncomingMessageId) {
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
      if (lastNotifiedReadIdRef.current === latestUnreadIncomingMessageId) {
        return;
      }
      lastNotifiedReadIdRef.current = latestUnreadIncomingMessageId;
      onUnreadViewed(latestUnreadIncomingMessageId);

      if (
        unreadAnchorMessageId &&
        dismissedUnreadAnchorId !== unreadAnchorMessageId &&
        !isUnreadDividerDismissing
      ) {
        dismissUnreadDivider();
      }
    }, [
      latestUnreadIncomingMessageId,
      onUnreadViewed,
      unreadAnchorMessageId,
      dismissedUnreadAnchorId,
      isUnreadDividerDismissing,
      dismissUnreadDivider,
    ]);

    useEffect(() => {
      if (!latestUnreadIncomingMessageId) {
        lastNotifiedReadIdRef.current = null;
      }
    }, [latestUnreadIncomingMessageId]);

    useEffect(() => {
      const viewport = scrollAreaRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement | null;
      if (!viewport) {
        return;
      }
      isNearBottomRef.current = isViewportNearBottom(viewport);
      maybeMarkVisibleIncomingAsViewed();
    }, [messages.length, isViewportNearBottom, maybeMarkVisibleIncomingAsViewed]);

    useEffect(() => {
      const root = scrollAreaRootRef.current;
      if (!root || !onLoadMore || !hasMore) {
        return;
      }
      const viewport = root.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement | null;
      if (!viewport) {
        return;
      }

      const maybeLoadMore = async () => {
        isNearBottomRef.current = isViewportNearBottom(viewport);
        maybeMarkVisibleIncomingAsViewed();
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
    }, [hasMore, onLoadMore, isViewportNearBottom, maybeMarkVisibleIncomingAsViewed]);

    useEffect(() => {
      const viewport = scrollAreaRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement | null;
      if (!viewport) {
        return;
      }
      const handleWindowStateChange = () => {
        isNearBottomRef.current = isViewportNearBottom(viewport);
        maybeMarkVisibleIncomingAsViewed();
      };
      window.addEventListener('focus', handleWindowStateChange);
      document.addEventListener('visibilitychange', handleWindowStateChange);
      return () => {
        window.removeEventListener('focus', handleWindowStateChange);
        document.removeEventListener('visibilitychange', handleWindowStateChange);
      };
    }, [isViewportNearBottom, maybeMarkVisibleIncomingAsViewed]);

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

    const threadRepliesByParent = useMemo(
      () => buildThreadRepliesByParent(sortedThreadSourceMessages),
      [sortedThreadSourceMessages],
    );

    const ensureExpandedThreadVisible = useCallback((parentId: UUID) => {
      window.requestAnimationFrame(() => {
        const messageElement = messageRefs.current.get(parentId);
        const scrollViewport = scrollAreaRootRef.current?.querySelector(
          '[data-slot="scroll-area-viewport"]',
        ) as HTMLDivElement | null;

        if (!messageElement || !scrollViewport) {
          return;
        }

        const messageRect = messageElement.getBoundingClientRect();
        const viewportRect = scrollViewport.getBoundingClientRect();
        const composerClearancePx = 120;
        const visibleBottom = viewportRect.bottom - composerClearancePx;
        const overflowPx = messageRect.bottom - visibleBottom;

        if (overflowPx <= 0) {
          return;
        }

        const nextTop = scrollViewport.scrollTop + overflowPx + 16;
        if (typeof scrollViewport.scrollTo === 'function') {
          scrollViewport.scrollTo({
            top: nextTop,
            behavior: 'smooth',
          });
          return;
        }

        scrollViewport.scrollTop = nextTop;
      });
    }, []);

    const scrollExpandedThreadToTop = useCallback((parentId: UUID) => {
      window.requestAnimationFrame(() => {
        const messageElement = messageRefs.current.get(parentId);
        const scrollViewport = scrollAreaRootRef.current?.querySelector(
          '[data-slot="scroll-area-viewport"]',
        ) as HTMLDivElement | null;

        if (!messageElement || !scrollViewport) {
          return;
        }

        const messageRect = messageElement.getBoundingClientRect();
        const viewportRect = scrollViewport.getBoundingClientRect();
        const offsetTop = messageRect.top - viewportRect.top - 16;
        const nextTop = Math.max(0, scrollViewport.scrollTop + offsetTop);

        if (typeof scrollViewport.scrollTo === 'function') {
          scrollViewport.scrollTo({
            top: nextTop,
            behavior: 'smooth',
          });
          return;
        }

        scrollViewport.scrollTop = nextTop;
      });
    }, []);

    const handleThreadIndicatorClick = useCallback(
      async (thread: ThreadVM, parentMessage: MessageVM) => {
        const parentId = thread.parent.messageId ?? parentMessage.ids.id;
        if (expandedThreadsByParent[parentId]) {
          setExpandedThreadsByParent((prev) => ({
            ...prev,
            [parentId]: false,
          }));
          return;
        }
        setOpenedThreadByParent((prev) => ({ ...prev, [parentId]: thread }));
        setExpandedThreadsByParent((prev) => ({
          ...prev,
          [parentId]: true,
        }));
        ensureExpandedThreadVisible(parentId);
        setLoadingThreadsByParent((prev) => ({ ...prev, [parentId]: true }));
        try {
          await onOpenThread(thread, parentMessage);
        } finally {
          setLoadingThreadsByParent((prev) => ({ ...prev, [parentId]: false }));
          ensureExpandedThreadVisible(parentId);
        }
      },
      [ensureExpandedThreadVisible, expandedThreadsByParent, onOpenThread],
    );

    const handleThreadDraftChange = useCallback((parentId: UUID, value: string) => {
      setDraftByParent((prev) => ({ ...prev, [parentId]: value }));
    }, []);

    const handleSendInlineReply = useCallback(
      async (parentMessage: MessageVM, thread: ThreadVM) => {
        const parentId = parentMessage.ids.id;
        const content = (draftByParent[parentId] ?? '').trim();
        if (!content) return;
        setSendingReplyByParent((prev) => ({ ...prev, [parentId]: true }));
        try {
          await onSendThreadReply?.(parentMessage, thread, content);
          setDraftByParent((prev) => ({ ...prev, [parentId]: '' }));
          pendingInlineReplyScrollParentRef.current = parentId;
        } finally {
          setSendingReplyByParent((prev) => ({ ...prev, [parentId]: false }));
        }
      },
      [draftByParent, onSendThreadReply],
    );

    useEffect(() => {
      const pendingParentId = pendingInlineReplyScrollParentRef.current;
      if (!pendingParentId || !expandedThreadsByParent[pendingParentId]) {
        return;
      }

      pendingInlineReplyScrollParentRef.current = null;
      scrollExpandedThreadToTop(pendingParentId);
    }, [expandedThreadsByParent, scrollExpandedThreadToTop, sortedThreadSourceMessages]);

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
              title={emptyStateTitle}
              description={emptyStateDescription}
              icon={emptyStateIcon}
              starterAction={emptyStateStarterAction}
            />
          </div>
        ) : null}
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="relative my-4 flex items-center">
              <div className="flex-1 border-t border-border" />
              <span className="mx-4 bg-background px-2 text-xs font-medium text-muted-foreground">
                {group.date}
              </span>
              <div className="flex-1 border-t border-border" />
            </div>
            {group.messages.map((message) => {
              const showUnreadDivider =
                unreadAnchorMessageId !== null &&
                dismissedUnreadAnchorId !== unreadAnchorMessageId &&
                message.ids.id === unreadAnchorMessageId;
              const isParentRightAligned = currentUserId === message.core.sender.ids.id;
              const inlineThread =
                openedThreadByParent[message.ids.id] ?? message.social.thread;
              const isInlineThreadExpanded =
                Boolean(inlineThread) && Boolean(expandedThreadsByParent[message.ids.id]);
              const inlineReplies = threadRepliesByParent.get(message.ids.id) ?? [];
              const inlineUnreadCount = Math.max(
                0,
                inlineThread?.readState?.unreadCount ?? 0,
              );
              const inlineUnreadStartIndex = findInlineUnreadStartIndex({
                replies: inlineReplies,
                lastReadMessageId: inlineThread?.readState?.lastReadMessageId,
                unreadCount: inlineThread?.readState?.unreadCount,
                currentUserId,
              });
              const feedInlineThreadContent =
                messageUiThemeKey === 'feed' && isInlineThreadExpanded ? (
                  <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {loadingThreadsByParent[message.ids.id] && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/70" />
                        Loading replies...
                      </div>
                    )}
                    {inlineReplies.map((reply, replyIndex) => {
                      const senderName = getProfileDisplayName(reply.core.sender.profile);
                      const isOwnReply = currentUserId === reply.core.sender.ids.id;
                      const shouldHideQuickActions = shouldHideMessageQuickActions(reply);
                      const replyActionState = getMessageActionState?.(reply.ids.id);
                      const isSavingReply = Boolean(replyActionState?.isSaving);
                      const isHidingReply = Boolean(replyActionState?.isHiding);
                      const isDeletingReply = Boolean(replyActionState?.isDeleting);
                      const isAddingReactionReply = Boolean(
                        replyActionState?.isAddingReaction,
                      );
                      const pendingReplyReactionEmojis =
                        replyActionState?.pendingReactionEmojis ?? [];

                      return (
                        <div key={reply.ids.id}>
                          {inlineUnreadStartIndex === replyIndex && (
                            <UnreadDivider
                              count={
                                inlineUnreadCount > 0 ? inlineUnreadCount : undefined
                              }
                              className="my-2"
                            />
                          )}
                          <div className="flex w-full items-start gap-3 py-0.5">
                            <AvatarWithStatus
                              accountId={reply.core.sender.ids.accountId}
                              profileId={reply.core.sender.ids.id}
                              name={senderName}
                              avatar={reply.core.sender.profile.avatar}
                              presence={reply.core.sender.presence}
                              themeKey={reply.core.sender.ui?.themeKey}
                              roleLabel={getAvatarRoleLabel(reply.core.sender.kind)}
                              timezone={reply.core.sender.prefs?.timezone ?? null}
                              locationLabel={getAvatarLocationLabel(
                                reply.core.sender.location,
                              )}
                              about={reply.core.sender.profile.bio ?? null}
                              sizeClassName="h-9 w-9 rounded-full"
                              fallbackClassName="text-sm"
                              onProfileClick={() =>
                                onProfileClick(reply.core.sender.ids.id)
                              }
                            />
                            <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/45 px-4 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                                    {isOwnReply ? 'You' : senderName}
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">
                                    {getAvatarRoleLabel(reply.core.sender.kind)}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <span className="whitespace-nowrap text-xs leading-none text-muted-foreground">
                                    {formatTime(reply.core.createdAt)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={isReadOnly || isSavingReply}
                                    onClick={() => onToggleSaved?.(reply.ids.id)}
                                    aria-label={
                                      reply.state?.isSaved
                                        ? 'Unsave message'
                                        : 'Save message'
                                    }
                                  >
                                    {isSavingReply ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Bookmark
                                        className={cn(
                                          'h-3.5 w-3.5',
                                          reply.state?.isSaved &&
                                            'fill-primary text-primary',
                                        )}
                                      />
                                    )}
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        aria-label="More actions"
                                      >
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      sideOffset={8}
                                      className="w-44 z-[100]"
                                    >
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                        className="py-2"
                                      >
                                        <Forward className="mr-2 h-4 w-4" />
                                        <span>Forward</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                        className="py-2"
                                      >
                                        <Copy className="mr-2 h-4 w-4" />
                                        <span>Copy text</span>
                                      </DropdownMenuItem>
                                      {isOwnReply || currentUserCanDeleteAnyMessages ? (
                                        <>
                                          <DropdownMenuSeparator />
                                          {isOwnReply ? (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                onToggleHidden?.(reply.ids.id)
                                              }
                                              disabled={isHidingReply}
                                              className="py-2"
                                            >
                                              {isHidingReply ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              ) : (
                                                <EyeOff className="mr-2 h-4 w-4" />
                                              )}
                                              <span>Hide message</span>
                                            </DropdownMenuItem>
                                          ) : null}
                                          <DropdownMenuItem
                                            onClick={() => onDelete?.(reply.ids.id)}
                                            disabled={isDeletingReply}
                                            className="py-2 text-destructive focus:text-destructive"
                                          >
                                            {isDeletingReply ? (
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="mr-2 h-4 w-4" />
                                            )}
                                            <span>Delete</span>
                                          </DropdownMenuItem>
                                        </>
                                      ) : null}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                              <p className="mt-3 break-words text-left text-sm leading-6 text-foreground/85">
                                {getInlineReplyPreview(reply)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <div
                                  className={cn(
                                    isReadOnly && 'pointer-events-none opacity-60',
                                  )}
                                >
                                  <ReactionBar
                                    reactions={reply.social.reactions}
                                    pendingEmojis={pendingReplyReactionEmojis}
                                    onToggleReaction={
                                      isReadOnly
                                        ? undefined
                                        : (emoji) =>
                                            onToggleReaction?.(reply.ids.id, emoji, 'bar')
                                    }
                                  />
                                </div>
                                {!shouldHideQuickActions ? (
                                  isReadOnly ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled
                                      className="h-7 w-7 rounded-full border border-border bg-background/60 text-muted-foreground"
                                      aria-label="Add emoji"
                                    >
                                      <SmilePlus className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <EmojiPicker
                                      onEmojiSelect={(emoji) =>
                                        onToggleReaction?.(reply.ids.id, emoji, 'picker')
                                      }
                                    >
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isAddingReactionReply}
                                        className="h-7 w-7 rounded-full border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label="Add emoji"
                                      >
                                        {isAddingReactionReply ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <SmilePlus className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </EmojiPicker>
                                  )
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!isReadOnly && (
                      <form
                        className="pt-1"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!inlineThread) return;
                          void handleSendInlineReply(message, inlineThread);
                        }}
                      >
                        <div className="flex w-full items-start gap-3 pt-1">
                          {currentUserComposerProfile ? (
                            <AvatarWithStatus
                              accountId={currentUserComposerProfile.ids.accountId}
                              profileId={currentUserComposerProfile.ids.id}
                              name={currentUserComposerName}
                              avatar={currentUserComposerProfile.profile.avatar}
                              presence={currentUserComposerProfile.presence}
                              themeKey={currentUserComposerProfile.ui?.themeKey}
                              roleLabel={getAvatarRoleLabel(
                                currentUserComposerProfile.kind,
                              )}
                              timezone={
                                currentUserComposerProfile.prefs?.timezone ?? null
                              }
                              locationLabel={getAvatarLocationLabel(
                                currentUserComposerProfile.location,
                              )}
                              about={currentUserComposerProfile.profile.bio ?? null}
                              sizeClassName="h-9 w-9 rounded-full"
                              fallbackClassName="text-sm"
                              onProfileClick={
                                currentUserId
                                  ? () => onProfileClick(currentUserId)
                                  : undefined
                              }
                            />
                          ) : null}
                          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/45 px-3 py-2">
                            <Input
                              value={draftByParent[message.ids.id] ?? ''}
                              onChange={(event) =>
                                handleThreadDraftChange(
                                  message.ids.id,
                                  event.target.value,
                                )
                              }
                              placeholder="Reply in thread..."
                              className="h-9 w-full rounded-full bg-background"
                              disabled={sendingReplyByParent[message.ids.id]}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="rounded-full"
                              disabled={
                                !(draftByParent[message.ids.id] ?? '').trim().length ||
                                Boolean(sendingReplyByParent[message.ids.id])
                              }
                            >
                              {sendingReplyByParent[message.ids.id] ? (
                                <>
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <MessageCircleReply className="mr-1.5 h-3.5 w-3.5" />
                                  Reply
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                ) : null;
              return (
                <div
                  key={message.ids.id}
                  ref={(el) => {
                    if (el) messageRefs.current.set(message.ids.id, el);
                    else messageRefs.current.delete(message.ids.id);
                  }}
                  className="relative transition-all duration-300"
                >
                  {showUnreadDivider && (
                    <UnreadDivider isDismissing={isUnreadDividerDismissing} />
                  )}
                  <MessageItem
                    message={message}
                    onOpenThread={handleThreadIndicatorClick}
                    isThreadReply={
                      Boolean(message.social.thread) &&
                      message.social.thread?.parent.messageId !== message.ids.id
                    }
                    isReadOnly={isReadOnly}
                    onProfileClick={onProfileClick}
                    onToggleReaction={onToggleReaction}
                    onToggleSaved={onToggleSaved}
                    onToggleHidden={onToggleHidden}
                    onDelete={onDelete}
                    actionState={getMessageActionState?.(message.ids.id)}
                    currentUserId={currentUserId}
                    currentUserCanDeleteAnyMessages={currentUserCanDeleteAnyMessages}
                    messageUiThemeKey={messageUiThemeKey}
                    inlineThreadContent={feedInlineThreadContent}
                  />
                  {isInlineThreadExpanded && messageUiThemeKey !== 'feed' && (
                    <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 pb-2 pl-10 pr-2">
                      <div
                        className={cn(
                          'ml-4 max-w-[680px] border-l-2 border-border/60 pl-5 space-y-1',
                          isParentRightAligned ? 'md:ml-auto' : '',
                        )}
                      >
                        {loadingThreadsByParent[message.ids.id] && (
                          <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/70" />
                            Loading replies...
                          </div>
                        )}
                        {inlineReplies.map((reply, replyIndex) => {
                          const senderName = getProfileDisplayName(
                            reply.core.sender.profile,
                          );
                          const isOwnReply = currentUserId === reply.core.sender.ids.id;
                          const shouldHideQuickActions =
                            shouldHideMessageQuickActions(reply);
                          const replyActionState = getMessageActionState?.(reply.ids.id);
                          const isSavingReply = Boolean(replyActionState?.isSaving);
                          const isHidingReply = Boolean(replyActionState?.isHiding);
                          const isDeletingReply = Boolean(replyActionState?.isDeleting);
                          const isAddingReactionReply = Boolean(
                            replyActionState?.isAddingReaction,
                          );
                          const pendingReplyReactionEmojis =
                            replyActionState?.pendingReactionEmojis ?? [];
                          return (
                            <div key={reply.ids.id}>
                              {inlineUnreadStartIndex === replyIndex && (
                                <UnreadDivider
                                  count={
                                    inlineUnreadCount > 0 ? inlineUnreadCount : undefined
                                  }
                                  className="my-2"
                                />
                              )}
                              <div className="flex w-full items-start gap-3">
                                <AvatarWithStatus
                                  accountId={reply.core.sender.ids.accountId}
                                  profileId={reply.core.sender.ids.id}
                                  name={senderName}
                                  avatar={reply.core.sender.profile.avatar}
                                  presence={reply.core.sender.presence}
                                  themeKey={reply.core.sender.ui?.themeKey}
                                  roleLabel={getAvatarRoleLabel(reply.core.sender.kind)}
                                  timezone={reply.core.sender.prefs?.timezone ?? null}
                                  locationLabel={getAvatarLocationLabel(
                                    reply.core.sender.location,
                                  )}
                                  about={reply.core.sender.profile.bio ?? null}
                                  sizeClassName="h-8 w-8 rounded-full"
                                  fallbackClassName="text-xs"
                                  onProfileClick={() =>
                                    onProfileClick(reply.core.sender.ids.id)
                                  }
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="min-w-0">
                                      <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                                        {isOwnReply ? 'You' : senderName}
                                      </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <span className="whitespace-nowrap text-xs leading-none text-muted-foreground">
                                        {formatTime(reply.core.createdAt)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={isReadOnly || isSavingReply}
                                        onClick={() => onToggleSaved?.(reply.ids.id)}
                                        aria-label={
                                          reply.state?.isSaved
                                            ? 'Unsave message'
                                            : 'Save message'
                                        }
                                      >
                                        {isSavingReply ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Bookmark
                                            className={cn(
                                              'h-3.5 w-3.5',
                                              reply.state?.isSaved &&
                                                'fill-primary text-primary',
                                            )}
                                          />
                                        )}
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            aria-label="More actions"
                                          >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          sideOffset={8}
                                          className="w-44 z-[100]"
                                        >
                                          <DropdownMenuItem
                                            onSelect={(e) => e.preventDefault()}
                                            className="py-2"
                                          >
                                            <Forward className="mr-2 h-4 w-4" />
                                            <span>Forward</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onSelect={(e) => e.preventDefault()}
                                            className="py-2"
                                          >
                                            <Copy className="mr-2 h-4 w-4" />
                                            <span>Copy text</span>
                                          </DropdownMenuItem>
                                          {isOwnReply ||
                                          currentUserCanDeleteAnyMessages ? (
                                            <>
                                              <DropdownMenuSeparator />
                                              {isOwnReply ? (
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    onToggleHidden?.(reply.ids.id)
                                                  }
                                                  disabled={isHidingReply}
                                                  className="py-2"
                                                >
                                                  {isHidingReply ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <EyeOff className="mr-2 h-4 w-4" />
                                                  )}
                                                  <span>Hide message</span>
                                                </DropdownMenuItem>
                                              ) : null}
                                              <DropdownMenuItem
                                                onClick={() => onDelete?.(reply.ids.id)}
                                                disabled={isDeletingReply}
                                                className="py-2 text-destructive focus:text-destructive"
                                              >
                                                {isDeletingReply ? (
                                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                )}
                                                <span>Delete</span>
                                              </DropdownMenuItem>
                                            </>
                                          ) : null}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                  <p className="mt-1 break-words text-left text-sm leading-relaxed text-foreground/85">
                                    {getInlineReplyPreview(reply)}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <div
                                      className={cn(
                                        isReadOnly && 'pointer-events-none opacity-60',
                                      )}
                                    >
                                      <ReactionBar
                                        reactions={reply.social.reactions}
                                        pendingEmojis={pendingReplyReactionEmojis}
                                        onToggleReaction={
                                          isReadOnly
                                            ? undefined
                                            : (emoji) =>
                                                onToggleReaction?.(
                                                  reply.ids.id,
                                                  emoji,
                                                  'bar',
                                                )
                                        }
                                      />
                                    </div>
                                    {!shouldHideQuickActions ? (
                                      isReadOnly ? (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          disabled
                                          className="h-7 w-7 rounded-full border border-border bg-background/60 text-muted-foreground"
                                          aria-label="Add emoji"
                                        >
                                          <SmilePlus className="h-4 w-4" />
                                        </Button>
                                      ) : (
                                        <EmojiPicker
                                          onEmojiSelect={(emoji) =>
                                            onToggleReaction?.(
                                              reply.ids.id,
                                              emoji,
                                              'picker',
                                            )
                                          }
                                        >
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={isAddingReactionReply}
                                            className="h-7 w-7 rounded-full border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label="Add emoji"
                                          >
                                            {isAddingReactionReply ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <SmilePlus className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </EmojiPicker>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {!isReadOnly && (
                          <form
                            className="pt-1"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (!inlineThread) return;
                              void handleSendInlineReply(message, inlineThread);
                            }}
                          >
                            <div className="flex w-full items-start gap-3">
                              {currentUserComposerProfile ? (
                                <AvatarWithStatus
                                  accountId={currentUserComposerProfile.ids.accountId}
                                  profileId={currentUserComposerProfile.ids.id}
                                  name={currentUserComposerName}
                                  avatar={currentUserComposerProfile.profile.avatar}
                                  presence={currentUserComposerProfile.presence}
                                  themeKey={currentUserComposerProfile.ui?.themeKey}
                                  roleLabel={getAvatarRoleLabel(
                                    currentUserComposerProfile.kind,
                                  )}
                                  timezone={
                                    currentUserComposerProfile.prefs?.timezone ?? null
                                  }
                                  locationLabel={getAvatarLocationLabel(
                                    currentUserComposerProfile.location,
                                  )}
                                  about={currentUserComposerProfile.profile.bio ?? null}
                                  sizeClassName="h-8 w-8 rounded-full"
                                  fallbackClassName="text-xs"
                                  onProfileClick={
                                    currentUserId
                                      ? () => onProfileClick(currentUserId)
                                      : undefined
                                  }
                                />
                              ) : null}
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <Input
                                  value={draftByParent[message.ids.id] ?? ''}
                                  onChange={(event) =>
                                    handleThreadDraftChange(
                                      message.ids.id,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Reply in thread..."
                                  className={cn('h-9 w-full rounded-full')}
                                  disabled={sendingReplyByParent[message.ids.id]}
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  className="rounded-full"
                                  disabled={
                                    !(draftByParent[message.ids.id] ?? '').trim()
                                      .length ||
                                    Boolean(sendingReplyByParent[message.ids.id])
                                  }
                                >
                                  {sendingReplyByParent[message.ids.id] ? (
                                    <>
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <MessageCircleReply className="mr-1.5 h-3.5 w-3.5" />
                                      Reply
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </form>
                        )}
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
