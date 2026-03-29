'use client';

import { memo, useMemo } from 'react';
import type { MessageVM } from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Bookmark } from 'lucide-react';
import { SavedMessagePreview } from '@iconicedu/ui-web/components/messages/saved-message-preview';
import { EmptyMessagesState } from '@iconicedu/ui-web/components/messages/empty-state';

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
    <div className="flex min-h-[70vh] w-full items-center justify-center">
      <EmptyMessagesState
        title="No saved messages"
        description="Save important messages by clicking the bookmark icon."
        icon={<Bookmark className="size-5" />}
      />
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
