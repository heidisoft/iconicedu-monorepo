import { describe, expect, it } from 'vitest';
import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';

import {
  buildReplyReferenceFromMessage,
  getMessageReplySnippet,
} from './message-reply-reference.utils';

const sender: UserProfileVM = {
  ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
  kind: 'guardian',
  profile: { displayName: 'Taylor Reed', avatar: { url: null, source: 'seed' } },
  prefs: {},
  meta: {},
  ui: { themeKey: null },
  joinedDate: '2026-01-01T00:00:00.000Z',
} as unknown as UserProfileVM;

function makeTextMessage(text: string): MessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      sender,
      createdAt: '2026-01-01T00:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    content: { text },
  } as unknown as MessageVM;
}

function makeImageMessage(): MessageVM {
  return {
    ids: { id: 'message-2', orgId: 'org-1' },
    core: {
      type: 'image',
      sender,
      createdAt: '2026-01-01T00:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    attachment: { type: 'image', url: 'https://example.com/a.png' },
  } as unknown as MessageVM;
}

describe('getMessageReplySnippet', () => {
  it('uses the message text, trimmed', () => {
    expect(getMessageReplySnippet(makeTextMessage('  Hello there  '))).toBe(
      'Hello there',
    );
  });

  it('truncates long text with an ellipsis', () => {
    const longText = 'a'.repeat(200);
    const snippet = getMessageReplySnippet(makeTextMessage(longText));
    expect(snippet.length).toBeLessThan(longText.length);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('falls back to a type-based label for non-text messages', () => {
    expect(getMessageReplySnippet(makeImageMessage())).toBe('Photo');
  });

  it('falls back to a generic label when text is empty/whitespace', () => {
    expect(getMessageReplySnippet(makeTextMessage('   '))).toBe('Message');
  });
});

describe('buildReplyReferenceFromMessage', () => {
  it('builds a compact reference snapshot for a text message', () => {
    const message = makeTextMessage('Sounds good, see you then');

    expect(buildReplyReferenceFromMessage(message)).toEqual({
      messageId: 'message-1',
      senderId: 'profile-1',
      senderName: 'Taylor Reed',
      snippet: 'Sounds good, see you then',
      type: 'text',
    });
  });
});
