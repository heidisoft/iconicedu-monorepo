/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { getSavedMessages } from './messages-saved-tab';

function buildMessage(id: string, createdAt: string, isSaved: boolean): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: {
        ids: { id: 'user-1', orgId: 'org-1', accountId: 'account-1' },
        kind: 'guardian',
        profile: { displayName: 'User 1', avatar: { source: 'seed', url: null } },
        prefs: {},
        meta: {},
        ui: { themeKey: null },
        joinedDate: createdAt,
      } as any,
      createdAt,
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved },
    content: { text: id },
  } as unknown as MessageVM;
}

describe('messages-saved-tab', () => {
  it('returns only saved messages sorted newest first', () => {
    const messages = [
      buildMessage('m1', '2026-01-01T10:00:00.000Z', true),
      buildMessage('m2', '2026-01-03T10:00:00.000Z', false),
      buildMessage('m3', '2026-01-02T10:00:00.000Z', true),
    ];

    expect(getSavedMessages(messages).map((message) => message.ids.id)).toEqual([
      'm3',
      'm1',
    ]);
  });
});
