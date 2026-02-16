import { useState, useCallback, memo } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  MessageCircle,
  MoreHorizontal,
  Bookmark,
  Forward,
  Copy,
  Trash2,
  EyeOff,
  Pin,
  SmilePlus,
} from 'lucide-react';
import { EmojiPicker } from '@iconicedu/ui-web/components/messages/emoji-picker';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';

interface MessageActionsProps {
  message: MessageVM;
  onOpenThread: (thread: ThreadVM, parentMessage: MessageVM) => void;
  onAddReaction?: (emoji: string) => void;
  onToggleSaved?: () => void;
  onToggleHidden?: () => void;
  onDelete?: () => void;
  isThreadReply?: boolean;
  onDropdownOpenChange?: (open: boolean) => void;
  currentUserId?: string;
}

export const MessageActions = memo(function MessageActions({
  message,
  onOpenThread,
  onAddReaction,
  onToggleSaved,
  onToggleHidden,
  onDelete,
  isThreadReply,
  onDropdownOpenChange,
  currentUserId,
}: MessageActionsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDropdownOpenChange = useCallback(
    (open: boolean) => {
      setIsDropdownOpen(open);
      onDropdownOpenChange?.(open);
    },
    [onDropdownOpenChange],
  );

  const handleThreadClick = useCallback(() => {
    if (message.social.thread) {
      onOpenThread(message.social.thread, message);
    } else {
      const snippet =
        'content' in message && message.content?.text ? message.content.text : null;
      const newThread: ThreadVM = {
        ids: { id: message.ids.id, orgId: message.ids.orgId },
        parent: {
          messageId: message.ids.id,
          snippet,
          authorId: message.core.sender.ids.id,
          authorName: getProfileDisplayName(message.core.sender.profile),
        },
        stats: {
          messageCount: 1,
          lastReplyAt: new Date().toISOString(),
        },
        participants: [message.core.sender],
      };
      onOpenThread(newThread, message);
    }
  }, [message, onOpenThread]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      onAddReaction?.(emoji);
    },
    [onAddReaction],
  );

  const handleHideClick = useCallback(() => {
    onToggleHidden?.();
    setIsDropdownOpen(false);
    onDropdownOpenChange?.(false);
  }, [onToggleHidden, onDropdownOpenChange]);

  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
    setIsDropdownOpen(false);
    onDropdownOpenChange?.(false);
  }, [onDropdownOpenChange]);

  const handleConfirmDelete = useCallback(() => {
    onDelete?.();
    setIsDeleteDialogOpen(false);
  }, [onDelete]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
  }, []);

  const isOwnMessage = currentUserId === message.core.sender.ids.id;

  return (
    <div className="absolute right-2 top-0 z-10 flex items-center gap-1 rounded-xl border bg-card px-1 py-1 shadow-md">
      {!isThreadReply && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleThreadClick}
                aria-label={message.social.thread ? 'Reply in thread' : 'Start a thread'}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{message.social.thread ? 'Reply in thread' : 'Start a thread'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <EmojiPicker onEmojiSelect={handleEmojiSelect}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Add reaction"
              >
                <SmilePlus className="h-4 w-4" />
              </Button>
            </EmojiPicker>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add reaction</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleSaved}
              aria-label={message.state?.isSaved ? 'Unsave message' : 'Save message'}
            >
              <Bookmark
                className={cn(
                  'h-4 w-4',
                  message.state?.isSaved && 'fill-primary text-primary',
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{message.state?.isSaved ? 'Unsave' : 'Save'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu open={isDropdownOpen} onOpenChange={handleDropdownOpenChange}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>More</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" sideOffset={10} className="w-48 z-[100]">
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="py-2">
            <Forward className="mr-2 h-4 w-4" />
            <span>Forward</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="py-2">
            <Copy className="mr-2 h-4 w-4" />
            <span>Copy text</span>
          </DropdownMenuItem>
          {isOwnMessage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleHideClick} className="py-2">
                <EyeOff className="mr-2 h-4 w-4" />
                <span>Hide message</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
                className="py-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
