import { describe, expect, it } from 'vitest';
import type { ChannelVM, SidebarLeftDataVM } from '@iconicedu/shared-types';

import { upsertDirectMessageChannel } from '@iconicedu/web/lib/sidebar/direct-message-realtime';

function makeSidebarData(directMessages: ChannelVM[]): SidebarLeftDataVM {
  return {
    user: {
      profile: { ids: { id: 'profile-self', orgId: 'org-1', accountId: 'account-self' } },
    },
    navigation: { navMain: [], navSecondary: [] },
    collections: {
      learningSpaces: [],
      directMessages,
    },
  } as unknown as SidebarLeftDataVM;
}

function makeChannel(id: string, unreadCount = 0): ChannelVM {
  return {
    ids: { id, orgId: 'org-1' },
    basics: { kind: 'dm', topic: `DM ${id}` },
    collections: {
      participants: [],
      messages: { items: [], total: 0 },
      media: { items: [], total: 0 },
      files: { items: [], total: 0 },
      readState: { channelId: id, unreadCount },
    },
  } as unknown as ChannelVM;
}

describe('upsertDirectMessageChannel', () => {
  it('adds a brand-new DM channel to the top', () => {
    const sidebarData = makeSidebarData([makeChannel('dm-1')]);
    const updated = upsertDirectMessageChannel(sidebarData, makeChannel('dm-2'));

    expect(updated.collections.directMessages.map((item) => item.ids.id)).toEqual(['dm-2', 'dm-1']);
  });

  it('keeps higher unread count when refreshing an existing channel', () => {
    const sidebarData = makeSidebarData([makeChannel('dm-1', 3), makeChannel('dm-2', 0)]);
    const updated = upsertDirectMessageChannel(sidebarData, makeChannel('dm-1', 0));

    expect(updated.collections.directMessages[0].ids.id).toBe('dm-1');
    expect(updated.collections.directMessages[0].collections.readState?.unreadCount).toBe(3);
  });

  it('applies minimum unread when channel read state has not persisted yet', () => {
    const channel = makeChannel('dm-new', 0);
    channel.collections.readState = undefined;
    const updated = upsertDirectMessageChannel(makeSidebarData([]), channel, {
      minimumUnreadCount: 1,
    });

    expect(updated.collections.directMessages[0].collections.readState).toEqual(
      expect.objectContaining({ channelId: 'dm-new', unreadCount: 1 }),
    );
  });
});
