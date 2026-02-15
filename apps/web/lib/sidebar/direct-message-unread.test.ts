import { describe, expect, it } from 'vitest';

import {
  applyIncomingDirectMessageUnread,
  markDirectMessageChannelRead,
} from '@iconicedu/web/lib/sidebar/direct-message-unread';

function makeSidebarData(unreadCount = 0) {
  return {
    user: {
      profile: { ids: { id: 'profile-self', accountId: 'account-self' } },
    },
    navigation: { navMain: [], navSecondary: [] },
    collections: {
      learningSpaces: [],
      directMessages: [
        {
          ids: { id: 'dm-1' },
          collections: {
            readState: { unreadCount },
          },
        },
      ],
    },
  } as any;
}

describe('direct message unread helpers', () => {
  it('increments unread count for incoming message in inactive dm', () => {
    const updated = applyIncomingDirectMessageUnread(makeSidebarData(1), {
      channelId: 'dm-1',
      senderProfileId: 'profile-other',
      currentProfileId: 'profile-self',
      activeChannelId: 'dm-2',
    });

    expect(updated.collections.directMessages[0].collections.readState.unreadCount).toBe(2);
  });

  it('does not increment unread count for messages sent by current profile', () => {
    const initial = makeSidebarData(3);
    const updated = applyIncomingDirectMessageUnread(initial, {
      channelId: 'dm-1',
      senderProfileId: 'profile-self',
      currentProfileId: 'profile-self',
      activeChannelId: 'dm-2',
    });

    expect(updated).toBe(initial);
  });

  it('keeps active dm unread at zero when message arrives', () => {
    const updated = applyIncomingDirectMessageUnread(makeSidebarData(0), {
      channelId: 'dm-1',
      senderProfileId: 'profile-other',
      currentProfileId: 'profile-self',
      activeChannelId: 'dm-1',
    });

    expect(updated.collections.directMessages[0].collections.readState.unreadCount).toBe(0);
  });

  it('marks active dm as read', () => {
    const updated = markDirectMessageChannelRead(makeSidebarData(4), 'dm-1');

    expect(updated.collections.directMessages[0].collections.readState.unreadCount).toBe(0);
  });
});
