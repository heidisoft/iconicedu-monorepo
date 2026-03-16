import { describe, expect, it } from 'vitest';
import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

import {
  applyIncomingDirectMessageUnread,
  markDirectMessageChannelRead,
  touchDirectMessageChannelOrder,
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
  } as unknown as SidebarLeftDataVM;
}

function makeSidebarDataWithTwoChannels() {
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
            readState: { unreadCount: 0 },
          },
        },
        {
          ids: { id: 'dm-2' },
          collections: {
            readState: { unreadCount: 0 },
          },
        },
      ],
    },
  } as unknown as SidebarLeftDataVM;
}

describe('direct message unread helpers', () => {
  it('increments unread count for incoming message in inactive dm', () => {
    const updated = applyIncomingDirectMessageUnread(makeSidebarData(1), {
      channelId: 'dm-1',
      senderProfileId: 'profile-other',
      currentProfileId: 'profile-self',
    });

    expect(updated.collections.directMessages[0].collections.readState.unreadCount).toBe(
      2,
    );
  });

  it('does not increment unread count for messages sent by current profile', () => {
    const initial = makeSidebarData(3);
    const updated = applyIncomingDirectMessageUnread(initial, {
      channelId: 'dm-1',
      senderProfileId: 'profile-self',
      currentProfileId: 'profile-self',
    });

    expect(updated).toBe(initial);
  });

  it('increments unread count for receiver even if dm is open', () => {
    const updated = applyIncomingDirectMessageUnread(makeSidebarData(0), {
      channelId: 'dm-1',
      senderProfileId: 'profile-other',
      currentProfileId: 'profile-self',
    });

    expect(updated.collections.directMessages[0].collections.readState.unreadCount).toBe(
      1,
    );
  });

  it('marks active dm as read', () => {
    const updated = markDirectMessageChannelRead(makeSidebarData(4), 'dm-1', {
      lastReadMessageId: 'message-4',
      lastReadAt: '2026-02-15T00:00:00.000Z',
    });

    expect(updated.collections.directMessages[0].collections.readState.unreadCount).toBe(
      0,
    );
    expect(
      updated.collections.directMessages[0].collections.readState.lastReadMessageId,
    ).toBe('message-4');
    expect(updated.collections.directMessages[0].collections.readState.lastReadAt).toBe(
      '2026-02-15T00:00:00.000Z',
    );
  });

  it('moves active channel to top on message activity', () => {
    const updated = touchDirectMessageChannelOrder(
      makeSidebarDataWithTwoChannels(),
      'dm-2',
    );
    expect(updated.collections.directMessages.map((channel) => channel.ids.id)).toEqual([
      'dm-2',
      'dm-1',
    ]);
  });
});
