/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildChannelsSidebarProjection,
  getLatestMessagesByChannelId,
  withLatestMessagePreview,
} from '@iconicedu/web/lib/channels/builders/channel-sidebar.builder';

const getChannelsByOrg = vi.fn();
const getChannelParticipantsByChannelIds = vi.fn();
const getChannelCapabilitiesByChannelIds = vi.fn();
const getChannelReadStatesByAccountId = vi.fn();
const getThreadReadStatesByAccountId = vi.fn();
const getProfilesByIds = vi.fn();
const buildChannelMessages = vi.fn();

vi.mock('@iconicedu/web/lib/channels/queries/channels.query', () => ({
  getChannelsByOrg: (...args: unknown[]) => getChannelsByOrg(...args),
  getChannelParticipantsByChannelIds: (...args: unknown[]) =>
    getChannelParticipantsByChannelIds(...args),
  getChannelCapabilitiesByChannelIds: (...args: unknown[]) =>
    getChannelCapabilitiesByChannelIds(...args),
  getChannelReadStatesByAccountId: (...args: unknown[]) =>
    getChannelReadStatesByAccountId(...args),
}));

vi.mock('@iconicedu/web/lib/messages/queries/messages.query', () => ({
  getThreadReadStatesByAccountId: (...args: unknown[]) =>
    getThreadReadStatesByAccountId(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/channel-messages.builder', () => ({
  buildChannelMessages: (...args: unknown[]) => buildChannelMessages(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileFromRow: vi.fn(async (_supabase: any, row: any) => ({
    ids: { id: row.id, orgId: row.org_id, accountId: row.account_id },
    profile: { displayName: row.display_name ?? row.id, avatar: { url: null } },
    prefs: {},
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    kind: row.kind ?? 'guardian',
  })),
}));

describe('buildChannelsSidebarProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches every channel exactly once and never builds threads/messages/media/files', async () => {
    getChannelsByOrg.mockResolvedValue({
      data: [
        { id: 'channel-1', org_id: 'org-1', kind: 'channel', topic: 'General' },
        { id: 'channel-2', org_id: 'org-1', kind: 'dm', topic: 'DM' },
      ],
    });
    getChannelParticipantsByChannelIds.mockResolvedValue({
      data: [
        { channel_id: 'channel-1', profile_id: 'profile-1' },
        { channel_id: 'channel-2', profile_id: 'profile-1' },
      ],
    });
    getChannelCapabilitiesByChannelIds.mockResolvedValue({ data: [] });
    getChannelReadStatesByAccountId.mockResolvedValue({
      data: [{ channel_id: 'channel-1', account_id: 'account-1', unread_count: 2 }],
    });
    getThreadReadStatesByAccountId.mockResolvedValue({
      data: [
        { channel_id: 'channel-1', account_id: 'account-1', unread_count: 1 },
        { channel_id: 'channel-1', account_id: 'account-1', unread_count: 3 },
      ],
    });
    getProfilesByIds.mockResolvedValue({
      data: [{ id: 'profile-1', org_id: 'org-1', account_id: 'account-1' }],
    });

    const results = await buildChannelsSidebarProjection({} as any, 'org-1', {
      accountId: 'account-1',
    });

    // Batched queries run exactly once each, regardless of channel count.
    expect(getChannelsByOrg).toHaveBeenCalledTimes(1);
    expect(getChannelParticipantsByChannelIds).toHaveBeenCalledTimes(1);
    expect(getChannelCapabilitiesByChannelIds).toHaveBeenCalledTimes(1);
    expect(getChannelReadStatesByAccountId).toHaveBeenCalledTimes(1);
    expect(getThreadReadStatesByAccountId).toHaveBeenCalledTimes(1);

    expect(results).toHaveLength(2);
    const channelOne = results.find((channel) => channel.ids.id === 'channel-1');
    expect(channelOne?.collections.messages).toEqual({ items: [], total: 0 });
    expect(channelOne?.collections.media).toEqual({ items: [], total: 0 });
    expect(channelOne?.collections.files).toEqual({ items: [], total: 0 });
    expect(channelOne?.collections.readState).toEqual(
      expect.objectContaining({ unreadCount: 2, threadUnreadCount: 4 }),
    );

    const channelTwo = results.find((channel) => channel.ids.id === 'channel-2');
    expect(channelTwo?.collections.readState).toEqual(
      expect.objectContaining({ unreadCount: 0, threadUnreadCount: 0 }),
    );
  });

  it('returns an empty list without querying anything when the org has no channels', async () => {
    getChannelsByOrg.mockResolvedValue({ data: [] });

    const results = await buildChannelsSidebarProjection({} as any, 'org-1', {
      accountId: 'account-1',
    });

    expect(results).toEqual([]);
    expect(getChannelParticipantsByChannelIds).not.toHaveBeenCalled();
  });
});

describe('getLatestMessagesByChannelId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeChannel = (id: string) => ({ ids: { id, orgId: 'org-1' } }) as any;

  it('fetches a bounded (limit 1) latest message once per unique channel id', async () => {
    buildChannelMessages.mockImplementation(
      async (_supabase: any, _orgId: string, channelId: string) =>
        channelId === 'channel-1' ? [{ ids: { id: 'message-1' } }] : [],
    );

    const result = await getLatestMessagesByChannelId({} as any, 'org-1', [
      makeChannel('channel-1'),
      makeChannel('channel-2'),
      makeChannel('channel-1'), // same channel appearing twice (e.g. alert + DM overlap)
    ]);

    expect(buildChannelMessages).toHaveBeenCalledTimes(2);
    expect(buildChannelMessages).toHaveBeenCalledWith({}, 'org-1', 'channel-1', {
      limit: 1,
    });
    expect(result.get('channel-1')).toEqual([{ ids: { id: 'message-1' } }]);
    expect(result.get('channel-2')).toEqual([]);
  });
});

describe('withLatestMessagePreview', () => {
  it('attaches the latest message when one exists for the channel', () => {
    const channel = {
      ids: { id: 'channel-1' },
      collections: { messages: { items: [], total: 0 }, participants: [] },
    } as any;
    const latestMessagesByChannelId = new Map([
      ['channel-1', [{ ids: { id: 'message-1' } }]],
    ]);

    const result = withLatestMessagePreview(channel, latestMessagesByChannelId as any);

    expect(result.collections.messages).toEqual({
      items: [{ ids: { id: 'message-1' } }],
      total: 1,
    });
    // Untouched fields are preserved.
    expect(result.collections.participants).toBe(channel.collections.participants);
  });

  it('returns the same channel unchanged when there is no latest message', () => {
    const channel = {
      ids: { id: 'channel-1' },
      collections: { messages: { items: [], total: 0 }, participants: [] },
    } as any;

    const result = withLatestMessagePreview(channel, new Map());

    expect(result).toBe(channel);
  });
});
