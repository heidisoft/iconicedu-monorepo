import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import {
  buildThreadRepliesByParent,
  getInlineReplyPreview,
} from './message-list.inline-thread.utils';

function createTextMessage(id: string, parentId?: string, text = 'hello'): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
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
        joinedDate: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      visibility: { type: 'all' },
    },
    social: parentId
      ? {
          reactions: [],
          thread: {
            ids: { id: 'thread-1', orgId: 'org-1' },
            parent: { messageId: parentId },
            stats: { messageCount: 2, lastReplyAt: new Date().toISOString() },
            participants: [],
          },
        }
      : { reactions: [] },
    content: { text },
  } as MessageVM;
}

describe('message-list.inline-thread.utils', () => {
  it('groups thread replies by parent message id', () => {
    const parent = createTextMessage('message-parent', 'message-parent', 'Parent');
    const replyOne = createTextMessage('message-reply-1', 'message-parent', 'Reply 1');
    const replyTwo = createTextMessage('message-reply-2', 'message-parent', 'Reply 2');

    const grouped = buildThreadRepliesByParent([parent, replyOne, replyTwo]);
    const replies = grouped.get('message-parent') ?? [];

    expect(replies).toHaveLength(2);
    expect(replies.map((item) => item.ids.id)).toEqual([
      'message-reply-1',
      'message-reply-2',
    ]);
  });

  it('returns text content for inline preview when present', () => {
    expect(
      getInlineReplyPreview(
        createTextMessage('message-1', 'message-parent', 'Reply body'),
      ),
    ).toBe('Reply body');
  });

  it('returns fallback preview when text content is empty', () => {
    expect(
      getInlineReplyPreview(createTextMessage('message-1', 'message-parent', '   ')),
    ).toBe('Shared an update');
  });
});
