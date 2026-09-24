import { memo, useState } from 'react';
import type { TextMessageVM as TextMessageType } from '@iconicedu/shared-types';
import { MESSAGE_EDIT_WINDOW_MINUTES } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { MessageTextContent } from '@iconicedu/ui-web/components/messages/message-text-content';
import { useOptionalMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { extractMentionsFromMessageText } from '@iconicedu/ui-web/components/messages/message-mentions.utils';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Loader2 } from 'lucide-react';

interface TextMessageProps extends Omit<MessageBaseProps, 'message' | 'children'> {
  message: TextMessageType;
}

function isWithinEditWindow(createdAt: string, now: number = Date.now()): boolean {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  const elapsedMinutes = (now - createdAtMs) / 60_000;
  return elapsedMinutes >= 0 && elapsedMinutes <= MESSAGE_EDIT_WINDOW_MINUTES;
}

export const TextMessage = memo(function TextMessage(props: TextMessageProps) {
  const { message, ...baseProps } = props;
  const messagesState = useOptionalMessagesState();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content.text);
  const [isSaving, setIsSaving] = useState(false);
  const [optimisticText, setOptimisticText] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const isOwnMessage = messagesState?.currentUserId === message.core.sender.ids.id;
  const canEdit =
    Boolean(messagesState) &&
    Boolean(messagesState?.enableMessageEdit) &&
    isOwnMessage &&
    !message.state?.isHidden &&
    isWithinEditWindow(message.core.createdAt);

  const handleStartEdit = () => {
    setEditValue(message.content.text);
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
    setEditValue(message.content.text);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || !messagesState) {
      return;
    }
    const participants = messagesState.channel.collections.participants ?? [];
    const mentions = extractMentionsFromMessageText(
      trimmed,
      participants,
      messagesState.currentUserId,
    );

    setIsEditing(false);
    setOptimisticText(trimmed);
    setIsSaving(true);
    setEditError(null);

    const save = async () => {
      try {
        await messagesState.editTextMessage({
          messageId: message.ids.id,
          content: trimmed,
          mentions,
        });
      } catch (error) {
        setOptimisticText(null);
        setEditError(
          error instanceof Error ? error.message : 'Failed to save the edited message',
        );
      } finally {
        setIsSaving(false);
      }
    };
    void save();
  };

  const displayText = optimisticText ?? message.content.text;

  return (
    <MessageBase
      message={message}
      {...baseProps}
      onEdit={canEdit ? handleStartEdit : undefined}
    >
      {isEditing ? (
        <div className="min-w-60 space-y-2">
          <Textarea
            autoFocus
            rows={3}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                handleCancelEdit();
                return;
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSaveEdit();
              }
            }}
            className="min-h-16 resize-none bg-background text-[15px]"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7"
              disabled={!editValue.trim()}
              onClick={handleSaveEdit}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              onClick={handleCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <MessageTextContent text={displayText} mentions={message.content.mentions} />
          {isSaving ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving edit...
            </span>
          ) : message.state?.isEdited ? (
            <span
              className="mt-0.5 text-[11px] text-muted-foreground"
              aria-label="Edited"
            >
              (edited)
            </span>
          ) : null}
          {editError ? (
            <p className="mt-0.5 text-[11px] text-destructive">{editError}</p>
          ) : null}
        </>
      )}
    </MessageBase>
  );
});
