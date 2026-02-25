'use client';

import { memo, useMemo } from 'react';
import type { MessageVM } from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Bookmark } from 'lucide-react';
import { SavedMessagePreview } from '@iconicedu/ui-web/components/messages/saved-message-preview';

interface MessagesSavedTabProps {
  messages: MessageVM[];
  onMessageClick: (messageId: string) => void;
}

export function getSavedMessages(messages: MessageVM[]): MessageVM[] {
  return [...messages]
    .filter((message) => message.state?.isSaved)
    .sort(
      (a, b) =>
        new Date(b.core.createdAt).getTime() - new Date(a.core.createdAt).getTime(),
    );
}

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Bookmark className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">No saved messages</h3>
        <p className="text-xs text-muted-foreground">
          Save important messages by clicking the bookmark icon
        </p>
      </div>
    </div>
  );
});

export function MessagesSavedTab({ messages, onMessageClick }: MessagesSavedTabProps) {
  const savedMessages = useMemo(() => getSavedMessages(messages), [messages]);

  if (savedMessages.length === 0) {
    return <EmptyState />;
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-2 p-4">
        {savedMessages.map((message) => (
          <SavedMessagePreview
            key={message.ids.id}
            message={message}
            onClick={() => onMessageClick(message.ids.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
