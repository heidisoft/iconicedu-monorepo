import { describe, expect, it, vi } from 'vitest';

import { buildSidebarBaseData } from '@iconicedu/web/lib/sidebar/buildSidebarBaseData';

const buildLearningSpacesByOrg = vi.fn();
const buildDirectMessageChannelsWithMessages = vi.fn();
const buildAllChannels = vi.fn();
const getChannelsByOrg = vi.fn();

vi.mock('@iconicedu/web/lib/spaces/builders/learning-space.builder', () => ({
  buildLearningSpacesByOrg: (...args: unknown[]) => buildLearningSpacesByOrg(...args),
}));

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildDirectMessageChannelsWithMessages: (...args: unknown[]) =>
    buildDirectMessageChannelsWithMessages(...args),
  buildAllChannels: (...args: unknown[]) => buildAllChannels(...args),
}));

vi.mock('@iconicedu/web/lib/channels/queries/channels.query', () => ({
  getChannelsByOrg: (...args: unknown[]) => getChannelsByOrg(...args),
}));

describe('buildSidebarBaseData', () => {
  it('builds classes and direct messages with account-scoped read state', async () => {
    buildLearningSpacesByOrg.mockResolvedValue([
      { ids: { id: 'space-1', orgId: 'org-1' } },
    ]);
    buildDirectMessageChannelsWithMessages.mockResolvedValue([
      { ids: { id: 'dm-1', orgId: 'org-1' } },
    ]);
    buildAllChannels.mockResolvedValue([
      {
        ids: { id: 'dm-1', orgId: 'org-1' },
        basics: { purpose: 'general', visibility: 'private' },
        collections: { participants: [{ ids: { accountId: 'account-1' } }] },
      },
      {
        ids: { id: 'general-1', orgId: 'org-1' },
        basics: { purpose: 'general', visibility: 'public' },
        collections: { participants: [] },
      },
      {
        ids: { id: 'space-channel-1', orgId: 'org-1' },
        basics: { purpose: 'learning-space', visibility: 'private' },
        collections: { participants: [{ ids: { accountId: 'account-1' } }] },
      },
    ]);
    getChannelsByOrg.mockResolvedValue({
      data: [{ id: 'support-1', purpose: 'support' }],
    });

    const result = await buildSidebarBaseData(
      {} as never,
      'org-1',
      'account-1',
      '/iconic-academy',
    );

    expect(buildLearningSpacesByOrg).toHaveBeenCalledWith(expect.anything(), 'org-1', {
      accountId: 'account-1',
    });
    expect(buildDirectMessageChannelsWithMessages).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      { accountId: 'account-1' },
    );
    expect(buildAllChannels).toHaveBeenCalledWith(expect.anything(), 'org-1', {
      accountId: 'account-1',
    });
    expect(result.collections.learningSpaces).toHaveLength(1);
    expect(result.collections.directMessages).toHaveLength(1);
    expect(result.collections.alertChannels).toHaveLength(2);
    expect(result.navigation.navSecondary[0]?.url).toBe('/iconic-academy/c/support-1');
  });
});
