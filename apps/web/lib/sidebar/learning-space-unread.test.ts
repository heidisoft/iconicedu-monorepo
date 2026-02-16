import { describe, expect, it } from 'vitest';
import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

import {
  applyIncomingLearningSpaceUnread,
  markLearningSpaceChannelRead,
} from '@iconicedu/web/lib/sidebar/learning-space-unread';

function makeSidebarData(unreadCount = 0) {
  return {
    user: {
      profile: { ids: { id: 'profile-self', accountId: 'account-self' } },
    },
    navigation: { navMain: [], navSecondary: [] },
    collections: {
      directMessages: [],
      learningSpaces: [
        {
          ids: { id: 'space-1', orgId: 'org-1' },
          channels: {
            primaryChannel: {
              ids: { id: 'channel-space-1', orgId: 'org-1' },
              collections: {
                readState: { channelId: 'channel-space-1', unreadCount },
              },
            },
            relatedChannels: [
              {
                ids: { id: 'channel-space-1-related', orgId: 'org-1' },
                collections: {
                  readState: {
                    channelId: 'channel-space-1-related',
                    unreadCount: 0,
                  },
                },
              },
            ],
          },
        },
      ],
    },
  } as unknown as SidebarLeftDataVM;
}

describe('learning space unread helpers', () => {
  it('increments unread count for incoming message in learning space channel', () => {
    const updated = applyIncomingLearningSpaceUnread(makeSidebarData(1), {
      channelId: 'channel-space-1',
      senderProfileId: 'profile-other',
      currentProfileId: 'profile-self',
    });

    expect(
      updated.collections.learningSpaces[0].channels.primaryChannel.collections.readState
        ?.unreadCount,
    ).toBe(2);
  });

  it('does not increment unread count for current profile messages', () => {
    const initial = makeSidebarData(2);
    const updated = applyIncomingLearningSpaceUnread(initial, {
      channelId: 'channel-space-1',
      senderProfileId: 'profile-self',
      currentProfileId: 'profile-self',
    });

    expect(updated).toBe(initial);
  });

  it('marks learning space channel as read', () => {
    const updated = markLearningSpaceChannelRead(makeSidebarData(4), 'channel-space-1', {
      lastReadMessageId: 'message-4',
      lastReadAt: '2026-02-16T00:00:00.000Z',
    });

    expect(
      updated.collections.learningSpaces[0].channels.primaryChannel.collections.readState
        ?.unreadCount,
    ).toBe(0);
    expect(
      updated.collections.learningSpaces[0].channels.primaryChannel.collections.readState
        ?.lastReadMessageId,
    ).toBe('message-4');
  });

  it('increments unread for related learning space channels', () => {
    const updated = applyIncomingLearningSpaceUnread(makeSidebarData(0), {
      channelId: 'channel-space-1-related',
      senderProfileId: 'profile-other',
      currentProfileId: 'profile-self',
    });

    expect(
      updated.collections.learningSpaces[0].channels.relatedChannels?.[0].collections.readState
        ?.unreadCount,
    ).toBe(1);
  });
});
