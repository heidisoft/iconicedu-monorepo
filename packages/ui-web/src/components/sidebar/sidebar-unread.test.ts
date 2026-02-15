import { describe, expect, it } from 'vitest';

import { getDirectMessageUnreadCount } from './sidebar-unread';

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
});
