import { useRef, useEffect } from 'react';
import { MessageInput } from '@iconicedu/ui-web/components/messages/message-input';
import type { ThreadPanelPropsVM } from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { ThreadMessageList } from '@iconicedu/ui-web/components/messages/shared/thread-message-list';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

export function ThreadSheet({
  replies,
  parentMessage,
  actions,
  currentUserId,
  readState,
  isReadOnly = false,
  onAttachReplyFile,
}: ThreadPanelPropsVM & {
  isReadOnly?: boolean;
  onAttachReplyFile?: (
    file: File,
    content?: string,
    options?: { durationSeconds?: number },
  ) => Promise<void> | void;
}) {
  const { channel } = useMessagesState();
  const {
    onSendReply,
    onProfileClick,
    onToggleReaction,
    onToggleSaved,
    onToggleHidden,
  } = actions;
  const messages = parentMessage ? [parentMessage, ...replies.items] : replies.items;
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(messages.length);

  useEffect(() => {
    if (messages.length > messageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    messageCountRef.current = messages.length;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 px-2 py-4">
        <ThreadMessageList
          messages={messages}
          onProfileClick={onProfileClick}
          isReadOnly={isReadOnly}
          onToggleReaction={onToggleReaction}
          onToggleSaved={onToggleSaved}
          onToggleHidden={onToggleHidden}
          currentUserId={currentUserId}
          lastReadMessageId={readState?.lastReadMessageId}
          unreadCount={readState?.unreadCount}
        />
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="flex-shrink-0 border-t border-border">
        {isReadOnly ? (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            Read-only supervised conversation
          </div>
        ) : (
          <MessageInput
            onSend={onSendReply}
            onAttachFile={onAttachReplyFile}
            placeholder="Reply..."
            sticky={false}
            participants={channel.collections.participants}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
}
