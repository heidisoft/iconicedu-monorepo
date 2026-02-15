import { describe, expect, it, vi } from 'vitest';

import { buildDirectMessageChannelsWithMessages } from '@iconicedu/web/lib/channels/builders/channel.builder';

const getChannelsByOrg = vi.fn();
const getChannelParticipantsByChannelIds = vi.fn();
const getChannelCapabilitiesByChannelIds = vi.fn();
const getChannelReadStatesByAccountId = vi.fn();
const getProfilesByIds = vi.fn();

vi.mock('@iconicedu/web/lib/channels/queries/channels.query', () => ({
  getChannelsByOrg: (...args: unknown[]) => getChannelsByOrg(...args),
  getChannelParticipantsByChannelIds: (...args: unknown[]) =>
    getChannelParticipantsByChannelIds(...args),
  getChannelCapabilitiesByChannelIds: (...args: unknown[]) =>
    getChannelCapabilitiesByChannelIds(...args),
  getChannelReadStatesByAccountId: (...args: unknown[]) =>
    getChannelReadStatesByAccountId(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/channel-messages.builder', () => ({
  buildChannelMessages: vi.fn(async () => []),
  buildChannelMedia: vi.fn(async () => []),
  buildChannelFiles: vi.fn(async () => []),
}));

vi.mock('@iconicedu/web/lib/messages/builders/thread.builder', () => ({
  buildThreadsByChannelId: vi.fn(async () => []),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileFromRow: vi.fn(async (_supabase: any, row: any) => {
    const resolvedAccountId =
      row.account_id ??
      row.accountId ??
      (row.id === 'profile-1' ? 'account-1' : 'account-2');
    return {
      ids: {
        id: row.id,
        orgId: row.org_id,
        accountId: resolvedAccountId,
      },
      profile: {
        displayName: row.display_name ?? row.id,
        avatar: { url: null, source: 'seed' },
      },
      prefs: {},
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      kind: row.kind ?? 'guardian',
    };
  }),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
}));

describe('buildDirectMessageChannelsWithMessages', () => {
  it('returns only channels that match the accountId', async () => {
    getChannelsByOrg.mockResolvedValue({
      data: [
        { id: 'dm-1', org_id: 'org-1', kind: 'dm', topic: 'DM', purpose: 'general' },
        { id: 'dm-2', org_id: 'org-1', kind: 'dm', topic: 'DM', purpose: 'general' },
      ],
    });
    getChannelParticipantsByChannelIds.mockResolvedValue({
      data: [
        { channel_id: 'dm-1', profile_id: 'profile-1' },
        { channel_id: 'dm-2', profile_id: 'profile-2' },
      ],
    });
    getChannelCapabilitiesByChannelIds.mockResolvedValue({ data: [] });
    getChannelReadStatesByAccountId.mockResolvedValue({ data: [] });
    getProfilesByIds.mockResolvedValue({
      data: [
        { id: 'profile-1', org_id: 'org-1', account_id: 'account-1', display_name: 'User 1' },
      ],
    });

    const results = await buildDirectMessageChannelsWithMessages({} as any, 'org-1', {
      accountId: 'account-1',
    });

    // Ensure mocks are invoked for membership filtering
    expect(getChannelParticipantsByChannelIds).toHaveBeenCalled();
    expect(getProfilesByIds).toHaveBeenCalled();
    const { buildUserProfileFromRow } = await import(
      '@iconicedu/web/lib/profile/builders/user-profile.builder'
    );
    expect(buildUserProfileFromRow).toHaveBeenCalled();

    expect(results).toHaveLength(1);
    expect(results[0]?.ids.id).toBe('dm-1');
  });

  it('provides a default channel read state when no persisted row exists', async () => {
    getChannelsByOrg.mockResolvedValue({
      data: [{ id: 'dm-1', org_id: 'org-1', kind: 'dm', topic: 'DM', purpose: 'general' }],
    });
    getChannelParticipantsByChannelIds.mockResolvedValue({
      data: [{ channel_id: 'dm-1', profile_id: 'profile-1' }],
    });
    getChannelCapabilitiesByChannelIds.mockResolvedValue({ data: [] });
    getChannelReadStatesByAccountId.mockResolvedValue({ data: [] });
    getProfilesByIds.mockResolvedValue({
      data: [{ id: 'profile-1', org_id: 'org-1', account_id: 'account-1', display_name: 'User 1' }],
    });

    const [result] = await buildDirectMessageChannelsWithMessages({} as any, 'org-1', {
      accountId: 'account-1',
    });

    expect(result?.collections.readState).toEqual(
      expect.objectContaining({ channelId: 'dm-1', unreadCount: 0 }),
    );
  });
});
