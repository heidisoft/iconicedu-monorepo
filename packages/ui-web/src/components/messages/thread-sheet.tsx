import { useRef, useEffect, useMemo, useCallback } from 'react';
import { MessageInput } from '@iconicedu/ui-web/components/messages/message-input';
import type {
  ConnectionVM,
  MessageMentionVM,
  MessageVM,
  ThreadReadStateVM,
  UUID,
} from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { ThreadMessageList } from '@iconicedu/ui-web/components/messages/shared/thread-message-list';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import type { MessageActionState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

type ThreadSheetProps = {
  replies: ConnectionVM<MessageVM>;
  parentMessage?: MessageVM;
  actions: {
    onSendReply: (
      content: string,
      mentions?: MessageMentionVM[],
      homework?: {
        kind?: 'homework' | 'lesson';
        title: string;
        description?: string;
        dueAt: string;
        subject?: string;
      } | null,
    ) => void;
    onProfileClick: (userId: UUID) => void;
    onToggleReaction?: (messageId: UUID, emoji: string) => void;
    onToggleSaved?: (messageId: UUID) => void;
    onToggleHidden?: (messageId: UUID) => void;
    onDelete?: (messageId: UUID) => void;
  };
  readState?: ThreadReadStateVM;
  currentUserId?: UUID;
};

export function ThreadSheet({
  replies,
  parentMessage,
  actions,
  currentUserId,
  readState,
  isReadOnly = false,
  showCreateMessageTypeButton = true,
  onAttachReplyFile,
  getMessageActionState,
}: ThreadSheetProps & {
  isReadOnly?: boolean;
  showCreateMessageTypeButton?: boolean;
  onAttachReplyFile?: (
    attachments: Array<{ file: File; durationSeconds?: number }>,
    content?: string,
  ) => Promise<void> | void;
  getMessageActionState?: (messageId: string) => MessageActionState | undefined;
}) {
  const { channel } = useMessagesState();
  const { onSendReply, onProfileClick, onToggleReaction, onToggleSaved, onToggleHidden } =
    actions;
  const messages = useMemo(
    () => (parentMessage ? [parentMessage, ...replies.items] : replies.items),
    [parentMessage, replies.items],
  );
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(messages.length);

  const scrollThreadPanelToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      const scrollViewport = scrollAreaRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement | null;

      if (!scrollViewport) {
        bottomRef.current?.scrollIntoView({ behavior });
        return;
      }

      const nextTop = scrollViewport.scrollHeight;
      if (typeof scrollViewport.scrollTo === 'function') {
        scrollViewport.scrollTo({
          top: nextTop,
          behavior,
        });
        return;
      }

      scrollViewport.scrollTop = nextTop;
    });
  }, []);

  useEffect(() => {
    if (messages.length > messageCountRef.current) {
      scrollThreadPanelToBottom('smooth');
    }
    messageCountRef.current = messages.length;
  }, [messages, scrollThreadPanelToBottom]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea ref={scrollAreaRootRef} className="flex-1 min-h-0 px-2 py-4">
        <ThreadMessageList
          messages={messages}
          onProfileClick={onProfileClick}
          isReadOnly={isReadOnly}
          onToggleReaction={onToggleReaction}
          onToggleSaved={onToggleSaved}
          onToggleHidden={onToggleHidden}
          getMessageActionState={getMessageActionState}
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
            onAttachFiles={onAttachReplyFile}
            placeholder="Reply..."
            sticky={false}
            participants={channel.collections.participants}
            currentUserId={currentUserId}
            showCreateMessageTypeButton={showCreateMessageTypeButton}
          />
        )}
      </div>
    </div>
  );
}
