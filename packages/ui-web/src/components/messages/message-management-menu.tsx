'use client';

import { useState, type ReactElement } from 'react';
import { ContextMenu } from 'radix-ui';
import {
  Bookmark,
  Copy,
  EyeOff,
  Forward,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import type { MessageVM, UUID } from '@iconicedu/shared-types';
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
  feed,
  children,
}: MessageManagementMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOwn = message.core.sender.ids.id === currentUserId;
  const Item = children ? ContextMenu.Item : DropdownMenuItem;
  const Separator = children ? ContextMenu.Separator : DropdownMenuSeparator;
  const itemClass =
    'relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
  const content = (
    <>
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
