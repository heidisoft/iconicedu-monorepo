'use client';

import type { FormEvent, RefObject } from 'react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import { Input } from '@iconicedu/ui-web/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@iconicedu/ui-web/ui/sheet';
import { MessageSquare, Send } from 'lucide-react';
import type { ChatMessageItem } from './zoom-video-session.types';
import { formatRelativeTime } from './zoom-video-session.utils';
import { ZoomMeetingDockButton } from './zoom-meeting-side-dock';

export function ZoomChatPanel({
  open,
  enabled = true,
  unreadCount,
  messages,
  draft,
  selfUserId,
  scrollRef,
  className,
  onOpenChange,
  onDraftChange,
  onSend,
}: {
  open: boolean;
  enabled?: boolean;
  unreadCount: number;
  messages: ChatMessageItem[];
  draft: string;
  selfUserId: number | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enabled) onSend();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <ZoomMeetingDockButton
          label="Messages"
          count={unreadCount}
          active={open}
          compact
          attention={unreadCount > 0}
          className={className}
        >
          <MessageSquare className="size-4" />
        </ZoomMeetingDockButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        dismissible
        overlayClassName="md:pointer-events-none md:bg-transparent"
        className="zoom-meeting-panel flex w-[calc(100vw-1rem)] flex-col gap-0 overflow-visible rounded-l-3xl p-0 sm:max-w-[32rem] [&>[data-slot=sheet-close]]:right-7 [&>[data-slot=sheet-close]]:top-7 md:rounded-[2rem] md:border md:data-[state=closed]:slide-out-to-bottom-4 md:data-[state=open]:slide-in-from-bottom-4 md:after:absolute md:after:-bottom-3 md:after:right-16 md:after:size-6 md:after:rotate-45 md:after:border-r md:after:border-b md:after:border-border md:after:bg-background lg:rounded-[2.5rem] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
      >
        <SheetHeader className="px-8 pb-4 pt-8">
          <SheetTitle className="text-3xl font-medium tracking-tight">
            In-call Messages
          </SheetTitle>
        </SheetHeader>
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-8 py-3"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((item) => {
              const isOwnMessage = item.senderUserId === selfUserId;
              return (
                <article key={item.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {isOwnMessage ? 'You' : item.senderName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed break-words text-muted-foreground">
                    {item.message}
                  </p>
                </article>
              );
            })
          )}
        </div>
        {enabled ? (
          <form
            onSubmit={submit}
            className="mx-8 mb-8 mt-4 flex items-center gap-2 rounded-full bg-muted p-1.5"
          >
            <Input
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Send a message"
              className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <IconActionButton
              type="submit"
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              disabled={!draft.trim()}
              label="Send message"
            >
              <Send />
            </IconActionButton>
          </form>
        ) : (
          <p className="px-8 py-6 text-sm text-muted-foreground">
            Sending messages is disabled for this meeting.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
