import { describe, expect, it } from 'vitest';

import {
  getDirectMessageItemUnreadCount,
  getDirectMessageUnreadCount,
} from './sidebar-unread';

describe('getDirectMessageUnreadCount', () => {
  it('sums unread counts across direct message channels', () => {
    const total = getDirectMessageUnreadCount([
      { collections: { readState: { unreadCount: 2 } } },
      { collections: { readState: { unreadCount: 3 } } },
      { collections: { readState: null } },
      { collections: {} },
    ] as any);

    expect(total).toBe(5);
  });

  it('ignores negative unread counts', () => {
    const total = getDirectMessageUnreadCount([
      { collections: { readState: { unreadCount: -10 } } },
      { collections: { readState: { unreadCount: 4 } } },
    ] as any);

    expect(total).toBe(4);
  });

  it('falls back to one unread for first incoming message when read state is not persisted yet', () => {
    const total = getDirectMessageUnreadCount(
      [
        {
          collections: {
            readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
            messages: {
              items: [
                {
                  core: {
                    sender: { ids: { accountId: 'account-other' } },
                  },
                },
              ],
            },
          },
        },
      ] as any,
      'account-self',
    );

    expect(total).toBe(1);
  });

  it('does not apply fallback unread when a read marker exists', () => {
    const unread = getDirectMessageItemUnreadCount(
      {
        collections: {
          readState: {
            unreadCount: 0,
            lastReadAt: '2026-02-16T00:00:00.000Z',
            lastReadMessageId: null,
          },
          messages: {
            items: [
              {
                core: {
                  sender: { ids: { accountId: 'account-other' } },
                },
              },
            ],
          },
        },
      } as any,
      'account-self',
    );

    expect(unread).toBe(0);
  });
});
