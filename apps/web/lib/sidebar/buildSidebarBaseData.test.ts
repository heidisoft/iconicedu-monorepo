import { describe, expect, it, vi } from 'vitest';

import { buildSidebarBaseData } from './buildSidebarBaseData';

const buildLearningSpacesSidebarProjection = vi.fn();
const buildChannelsSidebarProjection = vi.fn();

vi.mock('../spaces/builders/learning-space.builder', () => ({
  buildLearningSpacesSidebarProjection: (...args: unknown[]) =>
    buildLearningSpacesSidebarProjection(...args),
}));

vi.mock('../channels/builders/channel-sidebar.builder', () => ({
  buildChannelsSidebarProjection: (...args: unknown[]) =>
    buildChannelsSidebarProjection(...args),
}));

describe('buildSidebarBaseData', () => {
  it('builds classes and direct messages with account-scoped read state', async () => {
    buildLearningSpacesSidebarProjection.mockResolvedValue([
      { ids: { id: 'space-1', orgId: 'org-1' } },
    ]);
    buildChannelsSidebarProjection.mockResolvedValue([
      {
        ids: { id: 'dm-1', orgId: 'org-1' },
        basics: { kind: 'dm', purpose: 'general', visibility: 'private' },
        collections: { participants: [{ ids: { accountId: 'account-1' } }] },
        lifecycle: { createdAt: '2026-03-01T00:00:00.000Z' },
      },
      {
        ids: { id: 'general-1', orgId: 'org-1' },
        basics: { kind: 'channel', purpose: 'general', visibility: 'public' },
        collections: { participants: [] },
        lifecycle: { createdAt: '2026-03-02T00:00:00.000Z' },
      },
      {
        ids: { id: 'space-channel-1', orgId: 'org-1' },
        basics: { kind: 'channel', purpose: 'learning-space', visibility: 'private' },
        collections: { participants: [{ ids: { accountId: 'account-1' } }] },
        lifecycle: { createdAt: '2026-03-03T00:00:00.000Z' },
      },
      {
        ids: { id: 'class-request-1', orgId: 'org-1' },
        basics: { kind: 'channel', purpose: 'chass-requests', visibility: 'private' },
        collections: { participants: [{ ids: { accountId: 'account-1' } }] },
        lifecycle: { createdAt: '2026-03-04T00:00:00.000Z' },
      },
      {
        ids: { id: 'class-request-2', orgId: 'org-1' },
        basics: { kind: 'channel', purpose: 'chass-requests', visibility: 'private' },
        collections: { participants: [{ ids: { accountId: 'account-1' } }] },
        lifecycle: { createdAt: '2026-03-05T00:00:00.000Z' },
      },
      {
        ids: { id: 'support-1', orgId: 'org-1' },
        basics: { kind: 'channel', purpose: 'support', visibility: 'private' },
        collections: { participants: [] },
        lifecycle: { createdAt: '2026-03-06T00:00:00.000Z' },
      },
    ]);

    const result = await buildSidebarBaseData(
      {} as never,
      'org-1',
      'account-1',
      '/iconic-academy',
    );

    expect(buildChannelsSidebarProjection).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      { accountId: 'account-1' },
    );
    expect(buildLearningSpacesSidebarProjection).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      expect.any(Map),
    );
    expect(result.collections.learningSpaces).toHaveLength(1);
    expect(result.collections.directMessages).toHaveLength(1);
    expect(result.collections.directMessages[0].ids.id).toBe('dm-1');
    expect(result.collections.classRequestChannels).toHaveLength(2);
    expect(result.collections.alertChannels).toHaveLength(4);
    expect(result.navigation.navMain).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Notifications',
          url: '/iconic-academy/notifications',
          icon: 'notifications',
        }),
        expect.objectContaining({
          title: 'Class Requests',
          url: '/iconic-academy/c/class-request-2',
          icon: 'send',
          count: undefined,
        }),
      ]),
    );
    expect(result.navigation.navSecondary[0]?.title).toBe('Live Support');
    expect(result.navigation.navSecondary[0]?.url).toBe('/iconic-academy/c/support-1');
  });
});
