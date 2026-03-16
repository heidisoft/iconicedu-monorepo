import { describe, expect, it } from 'vitest';
import {
  buildMessageActionState,
  getComposerSubmitLabel,
} from './message-loading-state.utils';

describe('message-loading-state.utils', () => {
  it('builds per-message loading state from pending action maps', () => {
    expect(
      buildMessageActionState('message-1', {
        savingMessageIds: { 'message-1': true },
        hidingMessageIds: {},
        deletingMessageIds: {},
        reactionPickerMessageIds: { 'message-1': true },
        reactionEmojiKeys: {
          'message-1:👍': true,
          'message-1:🔥': true,
          'message-2:✅': true,
        },
      }),
    ).toEqual({
      isSaving: true,
      isHiding: false,
      isDeleting: false,
      isAddingReaction: true,
      pendingReactionEmojis: ['👍', '🔥'],
    });
  });

  it('returns undefined when a message has no pending actions', () => {
    expect(
      buildMessageActionState('message-1', {
        savingMessageIds: {},
        hidingMessageIds: {},
        deletingMessageIds: {},
        reactionPickerMessageIds: {},
        reactionEmojiKeys: {},
      }),
    ).toBeUndefined();
  });

  it('returns context-appropriate composer submit labels', () => {
    expect(getComposerSubmitLabel({ isSendingText: false, isAttachingFile: false })).toBe(
      'Send',
    );
    expect(getComposerSubmitLabel({ isSendingText: true, isAttachingFile: false })).toBe(
      'Sending...',
    );
    expect(getComposerSubmitLabel({ isSendingText: false, isAttachingFile: true })).toBe(
      'Uploading...',
    );
  });
});
