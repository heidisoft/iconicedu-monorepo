import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { findLatestIncomingMessageId } from './read-state.utils';

const baseMessage: MessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
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
  social: { reactions: [] },
  content: { text: 'Hello' },
};

describe('findLatestIncomingMessageId', () => {
  it('returns latest incoming message from sender', () => {
    const mine = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'mine' },
      core: {
        ...baseMessage.core,
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'me' },
        },
      },
    } as MessageVM;
    const incoming = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'incoming' },
      core: {
        ...baseMessage.core,
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'sender' },
        },
      },
    } as MessageVM;

    expect(findLatestIncomingMessageId([incoming, mine], 'me')).toBe('incoming');
  });

  it('returns null when all messages are from current user', () => {
    const mine = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'mine' },
      core: {
        ...baseMessage.core,
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'me' },
        },
      },
    } as MessageVM;

    expect(findLatestIncomingMessageId([mine], 'me')).toBeNull();
  });
});
