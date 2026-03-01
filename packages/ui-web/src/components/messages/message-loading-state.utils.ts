import type { MessageActionState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

export function buildMessageActionState(
  messageId: string,
  pending: {
    savingMessageIds: Record<string, true>;
    hidingMessageIds: Record<string, true>;
    deletingMessageIds: Record<string, true>;
    reactionPickerMessageIds: Record<string, true>;
    reactionEmojiKeys: Record<string, true>;
  },
): MessageActionState | undefined {
  const pendingReactionEmojis = Object.keys(pending.reactionEmojiKeys)
    .filter((key) => key.startsWith(`${messageId}:`))
    .map((key) => key.slice(messageId.length + 1));

  const state: MessageActionState = {
    isSaving: Boolean(pending.savingMessageIds[messageId]),
    isHiding: Boolean(pending.hidingMessageIds[messageId]),
    isDeleting: Boolean(pending.deletingMessageIds[messageId]),
    isAddingReaction: Boolean(pending.reactionPickerMessageIds[messageId]),
    pendingReactionEmojis,
  };

  if (
    !state.isSaving &&
    !state.isHiding &&
    !state.isDeleting &&
    !state.isAddingReaction &&
    pendingReactionEmojis.length === 0
  ) {
    return undefined;
  }

  return state;
}

export function getComposerSubmitLabel(input: {
  isSendingText: boolean;
  isAttachingFile: boolean;
}) {
  if (input.isAttachingFile) return 'Uploading...';
  if (input.isSendingText) return 'Sending...';
  return 'Send';
}
