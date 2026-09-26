'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { ContextMenu } from 'radix-ui';
import {
  Bookmark,
  Circle,
  Copy,
  CornerUpLeft,
  EyeOff,
  Forward,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { MessageVM, UUID } from '@iconicedu/shared-types';
import { useOptionalMessagesState } from './context/messages-state-provider';
import { Button } from '@iconicedu/ui-web/ui/button';
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
import type { MessageActionState } from './context/messages-state-provider';

type MessageManagementMenuProps = {
  message: MessageVM;
  currentUserId?: UUID;
  canDeleteAnyMessages?: boolean;
  isReadOnly?: boolean;
  actionState?: MessageActionState;
  onToggleSaved?: () => void;
  onToggleHidden?: () => void;
  onDelete?: () => void;
  /** Present only when the caller has already determined this message is edit-eligible. */
  onEdit?: () => void;
  feed?: boolean;
  children?: ReactElement;
};

// flag-exempt: match mobile's post menu and long-press access without repeated feed controls.
export function MessageManagementMenu({
  message,
  currentUserId,
  canDeleteAnyMessages,
  isReadOnly,
  actionState,
  onToggleSaved,
  onToggleHidden,
  onDelete,
  onEdit,
  feed,
  children,
}: MessageManagementMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isMarkingUnread, setIsMarkingUnread] = useState(false);
  const isOwn = message.core.sender.ids.id === currentUserId;
  const Item = children ? ContextMenu.Item : DropdownMenuItem;
  const Separator = children ? ContextMenu.Separator : DropdownMenuSeparator;
  const itemClass =
    'relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

  const messagesState = useOptionalMessagesState();
  const readState = messagesState?.channel?.collections.readState;
  const channelAlreadyShowsUnread =
    Boolean(readState?.isManuallyUnread) || (readState?.unreadCount ?? 0) > 0;
  const canReplyToMessage = Boolean(messagesState?.enableMessageReplyReference);
  const canMarkChannelUnread =
    Boolean(messagesState?.enableMessageMarkUnread) && !channelAlreadyShowsUnread;
  const channelId = messagesState?.channel?.ids?.id;

  const handleReply = useCallback(() => {
    messagesState?.startReplyTo(message);
  }, [messagesState, message]);

  const handleMarkUnread = useCallback(() => {
    if (!channelId) return;
    const markUnread = async () => {
      setIsMarkingUnread(true);
      try {
        await fetch('/api/messages/mark-unread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId, messageId: message.ids.id }),
        });
      } catch {
        // Best effort — the sidebar reconciles with server read-state on next load.
      } finally {
        setIsMarkingUnread(false);
      }
    };
    void markUnread();
  }, [channelId, message.ids.id]);

  const content = (
    <>
      {canReplyToMessage && (
        <Item className={itemClass} disabled={isReadOnly} onSelect={handleReply}>
          <CornerUpLeft className="mr-2 h-4 w-4" />
          Reply
        </Item>
      )}
      {canMarkChannelUnread && (
        <Item
          className={itemClass}
          disabled={isMarkingUnread}
          onSelect={handleMarkUnread}
        >
          {isMarkingUnread ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Circle className="mr-2 h-4 w-4" />
          )}
          Mark unread
        </Item>
      )}
      {(canReplyToMessage || canMarkChannelUnread) && (
        <Separator className="-mx-1 my-1 h-px bg-border" />
      )}
      {feed && (
        <Item
          className={itemClass}
          disabled={isReadOnly || actionState?.isSaving}
          onSelect={onToggleSaved}
        >
          {actionState?.isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bookmark className="mr-2 h-4 w-4" />
          )}
          {message.state?.isSaved ? 'Unsave message' : 'Save message'}
        </Item>
      )}
      {!feed && (
        <>
          <Item className={itemClass} onSelect={(event) => event.preventDefault()}>
            <Forward className="mr-2 h-4 w-4" />
            Forward
          </Item>
          <Item className={itemClass} onSelect={(event) => event.preventDefault()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy text
          </Item>
        </>
      )}
      {(isOwn || canDeleteAnyMessages) && (
        <>
          <Separator className="-mx-1 my-1 h-px bg-border" />
          {isOwn && onEdit && (
            <Item className={itemClass} disabled={isReadOnly} onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit message
            </Item>
          )}
          {isOwn && (
            <Item
              className={itemClass}
              disabled={isReadOnly || actionState?.isHiding}
              onSelect={onToggleHidden}
            >
              {actionState?.isHiding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="mr-2 h-4 w-4" />
              )}
              Hide message
            </Item>
          )}
          <Item
            className={`${itemClass} text-destructive`}
            disabled={isReadOnly || actionState?.isDeleting}
            onSelect={() => setConfirmDelete(true)}
          >
            {actionState?.isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Item>
        </>
      )}
    </>
  );
  return (
    <>
      {children ? (
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="z-[100] min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
              {content}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="More actions"
            >
              {feed ? (
                <MoreVertical className="h-[21px] w-[21px]" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-48 z-[100]">
            {content}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This message will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete?.();
                setConfirmDelete(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
