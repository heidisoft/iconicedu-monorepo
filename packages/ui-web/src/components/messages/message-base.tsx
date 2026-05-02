'use client';

import type { ReactNode } from 'react';
import { useState, useCallback, memo } from 'react';
import {
  AvatarWithStatus,
  getAvatarLocationLabel,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import type {
  MessageUiThemeKeyVM,
  MessageVM,
  ThreadVM,
  UUID,
} from '@iconicedu/shared-types';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  formatTime,
  formatFullDate,
  formatFeedDate,
} from '@iconicedu/ui-web/lib/message-utils';
import { ReactionBar } from '@iconicedu/ui-web/components/messages/shared/reaction-bar';
import { ThreadIndicator } from '@iconicedu/ui-web/components/messages/shared/thread-indicator';
import { VisibilityBadge } from '@iconicedu/ui-web/components/messages/shared/visibility-badge';
import { HiddenMessagePlaceholder } from '@iconicedu/ui-web/components/messages/shared/hidden-message-placeholder';
import { RoleNameIndicator } from '@iconicedu/ui-web/components/shared/role-name-indicator';
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
  BriefcaseBusiness,
  Copy,
  EyeOff,
  Forward,
  Loader2,
  MessageCircleReply,
  MoreHorizontal,
  Presentation,
  ShieldUser,
  SmilePlus,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import type { MessageActionState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

function getFeedRoleLabel(kind?: MessageVM['core']['sender']['kind'] | string | null) {
  switch (kind) {
    case 'guardian':
      return 'Parent';
    case 'child':
      return 'Student';
    case 'educator':
      return 'Tutor';
    case 'staff':
      return 'Support';
    case 'system':
      return 'System';
    default:
      return 'Member';
  }
}

function getFeedRoleIcon(kind?: MessageVM['core']['sender']['kind'] | string | null) {
  switch (kind) {
    case 'educator':
      return Presentation;
    case 'guardian':
      return ShieldUser;
    case 'staff':
      return BriefcaseBusiness;
    case 'system':
      return Sparkles;
    case 'child':
    default:
      return User;
  }
}

export interface MessageBaseProps {
  message: MessageVM;
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void | Promise<void>;
  isThreadReply?: boolean;
  isReadOnly?: boolean;
  children?: ReactNode;
  inlineThreadContent?: ReactNode;
  className?: string;
  onProfileClick: (userId: UUID) => void;
  onToggleReaction?: (emoji: string, source?: 'bar' | 'picker') => void;
  onToggleSaved?: () => void;
  onToggleHidden?: () => void;
  onDelete?: () => void;
  currentUserId?: UUID;
  canDeleteAnyMessages?: boolean;
  actionState?: MessageActionState;
  messageUiThemeKey?: MessageUiThemeKeyVM;
}

export const MessageBase = memo(function MessageBase({
  message,
  onOpenThread,
  isThreadReply = false,
  isReadOnly = false,
  children,
  inlineThreadContent,
  className,
  onProfileClick,
  onToggleReaction,
  onToggleSaved,
  onToggleHidden,
  onDelete,
  currentUserId,
  canDeleteAnyMessages = false,
  actionState,
  messageUiThemeKey = 'classic',
}: MessageBaseProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isThreadActionPending, setIsThreadActionPending] = useState(false);

  const senderName = getProfileDisplayName(message.core.sender.profile);
  const isOwnMessage = currentUserId === message.core.sender.ids.id;
  const senderLabel = isOwnMessage ? 'You' : senderName;
  const senderNameWithRole = (
    <RoleNameIndicator
      name={senderLabel}
      role={message.core.sender.kind}
      textClassName="truncate"
    />
  );
  const feedRoleLabel = getFeedRoleLabel(message.core.sender.kind);
  const FeedRoleIcon = getFeedRoleIcon(message.core.sender.kind);
  const isInteractionDisabled = Boolean(isReadOnly);
  const shouldHideQuickActions = shouldHideMessageQuickActions(message);
  const pendingReactionEmojis = actionState?.pendingReactionEmojis ?? [];
  const isSaving = Boolean(actionState?.isSaving);
  const isHiding = Boolean(actionState?.isHiding);
  const isDeleting = Boolean(actionState?.isDeleting);
  const isAddingReaction = Boolean(actionState?.isAddingReaction);
  const isFeedTheme = messageUiThemeKey === 'feed';
  const shouldFrameFeedContent =
    isFeedTheme &&
    ![
      'image',
      'file',
      'audio-recording',
      'link-preview',
      'lesson-assignment',
      'session-summary',
      'progress-update',
      'event-reminder',
      'homework-submission',
      'feedback-request',
      'session-booking',
      'payment-reminder',
      'live-session-started',
      'session-complete',
      'design-file-update',
    ].includes(message.core.type);

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
        {isOwnMessage || canDeleteAnyMessages ? (
          <>
            <DropdownMenuSeparator />
            {isOwnMessage ? (
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
            ) : null}
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
          <div className="flex-shrink-0">
            <AvatarWithStatus
              accountId={message.core.sender.ids.accountId}
              profileId={message.core.sender.ids.id}
              name={senderName}
              avatar={message.core.sender.profile.avatar}
              presence={message.core.sender.presence}
              themeKey={message.core.sender.ui?.themeKey}
              roleLabel={getAvatarRoleLabel(message.core.sender.kind)}
              timezone={message.core.sender.prefs?.timezone ?? null}
              locationLabel={getAvatarLocationLabel(message.core.sender.location)}
              about={message.core.sender.profile.bio ?? null}
              sizeClassName="h-9 w-9 rounded-full"
              onProfileClick={handleProfileClick}
            />
          </div>
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
                    {senderNameWithRole}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleProfileClick}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {senderNameWithRole}
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
        'group relative flex w-full items-start gap-3 transition-colors',
        isFeedTheme ? 'px-4 py-2 justify-start' : 'px-2 py-2',
        !isFeedTheme && (isOwnMessage ? 'justify-end' : 'justify-start'),
        className,
      )}
      data-message-id={message.ids.id}
      data-message-ui-theme={messageUiThemeKey}
    >
      <div
        className={cn(
          'relative flex w-full items-start',
          isFeedTheme
            ? 'max-w-[min(56rem,100%)] gap-3 rounded-xl border border-border bg-muted/25 px-3 py-3'
            : 'max-w-[min(78ch,85%)] gap-3',
          !isFeedTheme && (isOwnMessage ? 'flex-row-reverse' : 'flex-row'),
        )}
      >
        <div className="flex-shrink-0">
          <AvatarWithStatus
            accountId={message.core.sender.ids.accountId}
            profileId={message.core.sender.ids.id}
            name={senderName}
            avatar={message.core.sender.profile.avatar}
            presence={message.core.sender.presence}
            themeKey={message.core.sender.ui?.themeKey}
            roleLabel={getAvatarRoleLabel(message.core.sender.kind)}
            timezone={message.core.sender.prefs?.timezone ?? null}
            locationLabel={getAvatarLocationLabel(message.core.sender.location)}
            about={message.core.sender.profile.bio ?? null}
            sizeClassName={
              isFeedTheme ? 'h-10 w-10 rounded-full' : 'h-9 w-9 rounded-full'
            }
            statusClassName={isFeedTheme ? 'bottom-0 right-0 h-2 w-2' : undefined}
            fallbackClassName={isFeedTheme ? 'text-sm' : undefined}
            onProfileClick={handleProfileClick}
          />
        </div>

        <div className={cn('min-w-0', isFeedTheme ? 'w-full' : 'w-fit max-w-[78ch]')}>
          <div
            className={cn(
              'mb-2 flex items-center gap-2',
              isFeedTheme
                ? 'justify-start'
                : isOwnMessage
                  ? 'justify-end'
                  : 'justify-start',
            )}
          >
            {isFeedTheme ? (
              <div className="flex w-full items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={handleProfileClick}
                    className="block max-w-full truncate text-left text-sm font-semibold leading-tight text-foreground hover:underline"
                  >
                    {senderLabel}
                  </button>
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-none text-muted-foreground">
                    <FeedRoleIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{feedRoleLabel}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default whitespace-nowrap text-xs text-muted-foreground/90">
                            {formatFeedDate(message.core.createdAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatFullDate(message.core.createdAt)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {actionsMenu}
                  </div>
                  <VisibilityBadge message={message} />
                </div>
              </div>
            ) : isOwnMessage ? (
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
                  {senderNameWithRole}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleProfileClick}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {senderNameWithRole}
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
            {!isFeedTheme && <VisibilityBadge message={message} />}
            {message.state?.isEdited && (
              <span className={cn('text-[10px]', 'text-muted-foreground')}>(edited)</span>
            )}
          </div>

          <div
            className={cn('relative max-w-full', isFeedTheme ? 'block' : 'inline-block')}
          >
            <div
              className={cn(
                'max-w-full text-foreground',
                shouldFrameFeedContent
                  ? 'block w-full rounded-xl border border-border/70 bg-muted/45 px-4 py-3 text-sm leading-relaxed'
                  : isFeedTheme
                    ? 'block w-full text-sm leading-relaxed'
                    : 'w-fit rounded-[12px] px-3 py-2',
                !isFeedTheme && (isOwnMessage ? 'bg-primary/22' : 'bg-muted/45'),
              )}
            >
              {children}
            </div>
          </div>

          <div
            className={cn(
              'mt-2 flex flex-wrap items-center',
              isFeedTheme
                ? 'justify-start gap-1.5 text-xs'
                : isOwnMessage
                  ? 'justify-end gap-2'
                  : 'justify-start gap-2',
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
                size={isFeedTheme ? 'compact' : 'default'}
              />
            </div>

            {!shouldHideQuickActions ? (
              <>
                {isInteractionDisabled ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled
                    className={cn(
                      'rounded-full border border-border bg-background/60 text-muted-foreground',
                      isFeedTheme ? 'h-6 w-6' : 'h-7 w-7',
                    )}
                    aria-label="Add emoji"
                  >
                    <SmilePlus className={isFeedTheme ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </Button>
                ) : (
                  <EmojiPicker
                    onEmojiSelect={(emoji) => handleToggleReaction(emoji, 'picker')}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isAddingReaction}
                      className={cn(
                        'rounded-full border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                        isFeedTheme ? 'h-6 w-6' : 'h-7 w-7',
                      )}
                      aria-label="Add emoji"
                    >
                      {isAddingReaction ? (
                        <Loader2
                          className={cn(
                            'animate-spin',
                            isFeedTheme ? 'h-3.5 w-3.5' : 'h-4 w-4',
                          )}
                        />
                      ) : (
                        <SmilePlus className={isFeedTheme ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
                      size={isFeedTheme ? 'sm' : 'icon'}
                      onClick={handleThreadClick}
                      disabled={isInteractionDisabled || isThreadActionPending}
                      className={cn(
                        'rounded-full border border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                        isFeedTheme ? 'h-6 gap-1 px-2 text-xs' : 'h-7 w-7',
                      )}
                      aria-label="Reply"
                    >
                      {isThreadActionPending ? (
                        <Loader2
                          className={cn(
                            'animate-spin',
                            isFeedTheme ? 'h-3.5 w-3.5' : 'h-4 w-4',
                          )}
                        />
                      ) : (
                        <MessageCircleReply
                          className={isFeedTheme ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                        />
                      )}
                      {isFeedTheme ? <span>Reply</span> : null}
                    </Button>
                  )
                ) : null}
              </>
            ) : null}
          </div>

          {inlineThreadContent ? (
            <div className={cn('mt-3', isFeedTheme && 'border-t border-border/70 pt-3')}>
              {inlineThreadContent}
            </div>
          ) : null}
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
