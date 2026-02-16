'use client';

import { memo } from 'react';
import type { MessageVM } from '@iconicedu/shared-types';
import { MessageItem } from '@iconicedu/ui-web/components/messages/message-item';

interface ThreadMessageListProps {
  messages: MessageVM[];
  onProfileClick: (userId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onToggleSaved?: (messageId: string) => void;
  onToggleHidden?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  currentUserId?: string;
  lastReadMessageId?: string;
  unreadCount?: number;
}

const UnreadDivider = memo(function UnreadDivider({ count }: { count?: number }) {
  return (
    <div className="relative my-3 flex items-center px-2">
      <div className="flex-1 border-t border-yellow-200" />
      <span className="mx-3 text-xs font-medium text-yellow-700 bg-background px-2">
        NEW MESSAGES{count && count > 0 ? ` (${count})` : ''}
      </span>
      <div className="flex-1 border-t border-yellow-200" />
    </div>
  );
});

const ReplyDivider = memo(function ReplyDivider({ count }: { count: number }) {
  return (
    <div className="relative my-3 flex items-center px-2">
      <div className="flex-1 border-t border-border" />
      <span className="mx-3 text-xs text-muted-foreground">
        {count} {count === 1 ? 'reply' : 'replies'}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
});

export const ThreadMessageList = memo(function ThreadMessageList({
  messages,
  onProfileClick,
  onToggleReaction,
  onToggleSaved,
  onToggleHidden,
  onDelete,
  currentUserId,
  lastReadMessageId,
  unreadCount,
}: ThreadMessageListProps) {
  const handleOpenThread = () => {
    // Nested threads not supported in this view
  };

  const normalizedUnreadCount = Math.max(0, unreadCount ?? 0);
  const fallbackUnreadStartIndex =
    normalizedUnreadCount > 0
      ? Math.max(1, messages.length - normalizedUnreadCount)
      : -1;

  return (
    <>
      {messages.map((message, index) => {
        const previousMessage = index > 0 ? messages[index - 1] : null;
        const showUnreadDividerByReadAnchor =
          lastReadMessageId &&
          previousMessage?.ids.id === lastReadMessageId &&
          message.ids.id !== lastReadMessageId;
        const showUnreadDividerByFallback =
          !lastReadMessageId && fallbackUnreadStartIndex > 0 && index === fallbackUnreadStartIndex;
        const showUnreadDivider =
          showUnreadDividerByReadAnchor || showUnreadDividerByFallback;

        return (
          <div key={message.ids.id}>
            {showUnreadDivider && <UnreadDivider count={normalizedUnreadCount} />}
            <MessageItem
              message={message}
              onOpenThread={handleOpenThread}
              isThreadReply={index > 0}
              onProfileClick={onProfileClick}
              onToggleReaction={onToggleReaction}
              onToggleSaved={onToggleSaved}
              onToggleHidden={onToggleHidden}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
            {index === 0 && messages.length > 1 && (
              <ReplyDivider count={messages.length - 1} />
            )}
          </div>
        );
      })}
    </>
  );
});
