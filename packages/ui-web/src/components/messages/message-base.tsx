'use client';

import type { ReactNode } from 'react';
import { useState, useCallback, memo } from 'react';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import type { MessageVM, ThreadVM, UUID } from '@iconicedu/shared-types';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { formatTime, formatFullDate } from '@iconicedu/ui-web/lib/message-utils';
import { ReactionBar } from '@iconicedu/ui-web/components/messages/shared/reaction-bar';
import { ThreadIndicator } from '@iconicedu/ui-web/components/messages/shared/thread-indicator';
import { VisibilityBadge } from '@iconicedu/ui-web/components/messages/shared/visibility-badge';
import { HiddenMessagePlaceholder } from '@iconicedu/ui-web/components/messages/shared/hidden-message-placeholder';
import { MessageActions } from '@iconicedu/ui-web/components/messages/message-actions';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';

export interface MessageBaseProps {
  message: MessageVM;
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void;
  isThreadReply?: boolean;
  children?: ReactNode;
  className?: string;
  onProfileClick: (userId: UUID) => void;
  onToggleReaction?: (emoji: string) => void;
  onToggleSaved?: () => void;
  onToggleHidden?: () => void;
  onDelete?: () => void;
  currentUserId?: UUID;
}

export const MessageBase = memo(function MessageBase({
  message,
  onOpenThread,
  isThreadReply = false,
  children,
  className,
  onProfileClick,
  onToggleReaction,
  onToggleSaved,
  onToggleHidden,
  onDelete,
  currentUserId,
}: MessageBaseProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleProfileClick = useCallback(() => {
    onProfileClick(message.core.sender.ids.id);
  }, [onProfileClick, message.core.sender.ids.id]);

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      onToggleReaction?.(emoji);
    },
    [onToggleReaction],
  );

  const handleThreadClick = useCallback(() => {
    if (message.social.thread) {
      onOpenThread(message.social.thread, message);
    }
  }, [message, onOpenThread]);

  const senderName = getProfileDisplayName(message.core.sender.profile);
  const isOwnMessage = currentUserId === message.core.sender.ids.id;
  const senderLabel = isOwnMessage ? 'You' : senderName;

  if (message.state?.isHidden) {
    return (
      <div
        className={cn(
          'group relative flex w-full items-start gap-3 px-2 py-1.5',
          isOwnMessage ? 'justify-end' : 'justify-start',
        )}
      >
        <div
          className={cn(
            'flex w-full max-w-[min(78ch,85%)] items-start gap-3',
            isOwnMessage ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <button
            onClick={handleProfileClick}
            className="flex-shrink-0 transition-opacity hover:opacity-80"
            aria-label={`View ${senderName}'s profile`}
          >
            <AvatarWithStatus
              name={senderName}
              avatar={message.core.sender.profile.avatar}
              themeKey={message.core.sender.ui?.themeKey}
              sizeClassName="h-9 w-9"
              initialsLength={1}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'mb-1 flex items-center gap-2',
                isOwnMessage ? 'justify-end' : 'justify-start',
              )}
            >
              {isOwnMessage ? (
                <>
                  <span className="text-xs text-muted-foreground cursor-default">
                    {formatTime(message.core.createdAt)}
                  </span>
                  <button
                    onClick={handleProfileClick}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {senderLabel}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleProfileClick}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {senderLabel}
                  </button>
                  <span className="text-xs text-muted-foreground cursor-default">
                    {formatTime(message.core.createdAt)}
                  </span>
                </>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="sr-only">{formatTime(message.core.createdAt)}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatFullDate(message.core.createdAt)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <HiddenMessagePlaceholder
              onUnhide={onToggleHidden}
              canUnhide={isOwnMessage}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex w-full items-start gap-3 px-2 py-2 transition-colors',
        isOwnMessage ? 'justify-end' : 'justify-start',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDropdownOpen) {
          setIsHovered(false);
        }
      }}
      data-message-id={message.ids.id}
    >
      <div
        className={cn(
          'relative flex w-full max-w-[min(78ch,85%)] items-start gap-3',
          isOwnMessage ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        <button
          onClick={handleProfileClick}
          className="flex-shrink-0 transition-opacity hover:opacity-80"
          aria-label={`View ${senderName}'s profile`}
        >
          <AvatarWithStatus
            name={senderName}
            avatar={message.core.sender.profile.avatar}
            themeKey={message.core.sender.ui?.themeKey}
            sizeClassName="h-9 w-9"
            initialsLength={1}
          />
        </button>

        <div className="min-w-0 w-fit max-w-[78ch]">
          <div
            className={cn(
              'mb-2 flex items-center gap-2',
              isOwnMessage ? 'justify-end' : 'justify-start',
            )}
          >
            {isOwnMessage ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default text-xs text-muted-foreground/90">
                        {formatTime(message.core.createdAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatFullDate(message.core.createdAt)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button
                  onClick={handleProfileClick}
                  className="text-sm font-semibold text-muted-foreground/80 hover:underline"
                >
                  {senderLabel}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleProfileClick}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {senderLabel}
                </button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default text-xs text-muted-foreground/90">
                        {formatTime(message.core.createdAt)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatFullDate(message.core.createdAt)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            <VisibilityBadge message={message} />
            {message.state?.isEdited && (
              <span className={cn('text-[10px]', 'text-muted-foreground')}>(edited)</span>
            )}
          </div>

          <div className="relative inline-block max-w-full">
            <div
              className={cn(
                'inline-block w-fit max-w-full rounded-[12px] px-3 py-2',
                isOwnMessage
                  ? 'bg-primary/22 text-foreground'
                  : 'bg-muted/45 text-foreground',
              )}
            >
              {children}
            </div>

            {(isHovered || isDropdownOpen) && (
              <MessageActions
                message={message}
                onOpenThread={onOpenThread}
                onAddReaction={handleToggleReaction}
                onToggleSaved={onToggleSaved}
                onToggleHidden={onToggleHidden}
                onDelete={onDelete}
                isThreadReply={isThreadReply}
                onDropdownOpenChange={setIsDropdownOpen}
                currentUserId={currentUserId}
                className={cn(
                  'top-0 z-20 -translate-y-1/2',
                  isOwnMessage
                    ? 'left-0 right-auto -translate-x-1/2'
                    : 'right-0 left-auto translate-x-1/2',
                )}
              />
            )}
          </div>

          <div
            className={cn(
              'mt-2 flex flex-wrap gap-2',
              isOwnMessage ? 'justify-end' : 'justify-start',
            )}
          >
            <ReactionBar
              reactions={message.social.reactions}
              onToggleReaction={handleToggleReaction}
            />

            {message.social.thread && !isThreadReply && (
              <ThreadIndicator
                thread={message.social.thread}
                onClick={handleThreadClick}
                unreadCount={message.social.thread.readState?.unreadCount}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
