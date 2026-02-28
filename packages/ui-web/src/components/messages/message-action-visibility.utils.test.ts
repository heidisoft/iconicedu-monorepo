import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';

import {
  isEmojiOnlyText,
  shouldHideMessageQuickActions,
} from './message-action-visibility.utils';

function createMessage(text: string): MessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: '2026-01-01T00:00:00.000Z',
      visibility: { type: 'all' },
      sender: {
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        kind: 'guardian',
        profile: {
          displayName: 'User 1',
          avatar: { url: null, source: 'seed' },
        },
        prefs: {},
        meta: {},
        ui: { themeKey: null },
        joinedDate: '2026-01-01T00:00:00.000Z',
      },
    },
    social: { reactions: [] },
    content: { text },
  } as MessageVM;
}

describe('message-action-visibility utils', () => {
  it('detects emoji-only text messages', () => {
    expect(isEmojiOnlyText('😀')).toBe(true);
    expect(isEmojiOnlyText('😀 😄')).toBe(true);
    expect(isEmojiOnlyText('👨‍👩‍👧‍👦')).toBe(true);
    expect(isEmojiOnlyText('🇺🇸')).toBe(true);
    expect(isEmojiOnlyText('1️⃣ 2️⃣')).toBe(true);
  });

  it('keeps quick actions for messages with non-emoji text', () => {
    expect(isEmojiOnlyText('hello 😀')).toBe(false);
    expect(isEmojiOnlyText('')).toBe(false);
    expect(isEmojiOnlyText('   ')).toBe(false);
  });

  it('hides quick actions only for emoji-only messages', () => {
    expect(shouldHideMessageQuickActions(createMessage('🔥 🎉'))).toBe(true);
    expect(shouldHideMessageQuickActions(createMessage('See you 🔥'))).toBe(false);
  });
});
