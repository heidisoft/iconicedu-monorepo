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
import { shouldHideMessageQuickActions } from '@iconicedu/ui-web/components/messages/message-action-visibility.utils';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { Button } from '@iconicedu/ui-web/ui/button';
import { EmojiPicker } from '@iconicedu/ui-web/components/messages/emoji-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@iconicedu/ui-web/ui/alert-dialog';
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
import type { MessageActionState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

export interface MessageBaseProps {
  message: MessageVM;
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void | Promise<void>;
  isThreadReply?: boolean;
  isReadOnly?: boolean;
  children?: ReactNode;
  className?: string;
  onProfileClick: (userId: UUID) => void;
  onToggleReaction?: (emoji: string, source?: 'bar' | 'picker') => void;
  onToggleSaved?: () => void;
  onToggleHidden?: () => void;
  onDelete?: () => void;
  currentUserId?: UUID;
  actionState?: MessageActionState;
}

export const MessageBase = memo(function MessageBase({
  message,
  onOpenThread,
  isThreadReply = false,
  isReadOnly = false,
  children,
  className,
  onProfileClick,
  onToggleReaction,
  onToggleSaved,
  onToggleHidden,
  onDelete,
  currentUserId,
  actionState,
}: MessageBaseProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isThreadActionPending, setIsThreadActionPending] = useState(false);

  const senderName = getProfileDisplayName(message.core.sender.profile);
  const isOwnMessage = currentUserId === message.core.sender.ids.id;
  const senderLabel = isOwnMessage ? 'You' : senderName;
  const isInteractionDisabled = Boolean(isReadOnly);
  const shouldHideQuickActions = shouldHideMessageQuickActions(message);
  const pendingReactionEmojis = actionState?.pendingReactionEmojis ?? [];
  const isSaving = Boolean(actionState?.isSaving);
  const isHiding = Boolean(actionState?.isHiding);
  const isDeleting = Boolean(actionState?.isDeleting);
  const isAddingReaction = Boolean(actionState?.isAddingReaction);

  const handleProfileClick = useCallback(() => {
    onProfileClick(message.core.sender.ids.id);
  }, [onProfileClick, message.core.sender.ids.id]);

  const handleToggleReaction = useCallback(
    (emoji: string, source: 'bar' | 'picker' = 'bar') => {
      if (isInteractionDisabled) return;
      onToggleReaction?.(emoji, source);
    },
    [isInteractionDisabled, onToggleReaction],
  );

  const handleThreadClick = useCallback(() => {
    const openThread = async () => {
      setIsThreadActionPending(true);
      try {
        if (message.social.thread) {
          await Promise.resolve(onOpenThread(message.social.thread, message));
          return;
        }
        if (isInteractionDisabled) return;

        const snippet =
          'content' in message && message.content?.text ? message.content.text : null;
        const newThread: ThreadVM = {
          ids: { id: message.ids.id, orgId: message.ids.orgId },
          parent: {
            messageId: message.ids.id,
            snippet,
            authorId: message.core.sender.ids.id,
            authorName: senderName,
          },
          stats: {
            messageCount: 1,
            lastReplyAt: new Date().toISOString(),
          },
          participants: [message.core.sender],
        };

        await Promise.resolve(onOpenThread(newThread, message));
      } finally {
        setIsThreadActionPending(false);
      }
    };

    void openThread();
  }, [isInteractionDisabled, message, onOpenThread, senderName]);

  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete?.();
    setIsDeleteDialogOpen(false);
  }, [onDelete]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-48 z-[100]">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="py-2">
          <Forward className="mr-2 h-4 w-4" />
          <span>Forward</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="py-2">
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy text</span>
        </DropdownMenuItem>
        {isOwnMessage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onToggleHidden}
              disabled={isHiding}
              className="py-2"
            >
              {isHiding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="mr-2 h-4 w-4" />
              )}
              <span>Hide message</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="py-2 text-destructive focus:text-destructive"
            >
              {isDeleting ? (
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
  );

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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleSaved}
                  disabled={isInteractionDisabled || isSaving}
                  aria-label={message.state?.isSaved ? 'Unsave message' : 'Save message'}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bookmark
                      className={cn(
                        'h-4 w-4',
                        message.state?.isSaved && 'fill-primary text-primary',
                      )}
                    />
                  )}
                </Button>
                {actionsMenu}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onToggleSaved}
                  disabled={isInteractionDisabled || isSaving}
                  aria-label={message.state?.isSaved ? 'Unsave message' : 'Save message'}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bookmark
                      className={cn(
                        'h-4 w-4',
                        message.state?.isSaved && 'fill-primary text-primary',
                      )}
                    />
                  )}
                </Button>
                {actionsMenu}
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
          </div>

          <div
            className={cn(
              'mt-2 flex flex-wrap items-center gap-2',
              isOwnMessage ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(isInteractionDisabled && 'pointer-events-none opacity-60')}
            >
              <ReactionBar
                reactions={message.social.reactions}
                onToggleReaction={
                  isInteractionDisabled ? undefined : handleToggleReaction
                }
                pendingEmojis={pendingReactionEmojis}
              />
            </div>

            {!shouldHideQuickActions ? (
              <>
                {isInteractionDisabled ? (
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
                    onEmojiSelect={(emoji) => handleToggleReaction(emoji, 'picker')}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isAddingReaction}
                      className="h-7 w-7 rounded-full border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Add emoji"
                    >
                      {isAddingReaction ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SmilePlus className="h-4 w-4" />
                      )}
                    </Button>
                  </EmojiPicker>
                )}

                {!isThreadReply ? (
                  message.social.thread ? (
                    <ThreadIndicator
                      thread={message.social.thread}
                      onClick={handleThreadClick}
                      unreadCount={message.social.thread.readState?.unreadCount}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleThreadClick}
                      disabled={isInteractionDisabled || isThreadActionPending}
                      className="h-7 w-7 rounded-full border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Reply"
                    >
                      {isThreadActionPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircleReply className="h-4 w-4" />
                      )}
                    </Button>
                  )
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This message will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
