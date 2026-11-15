/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildLearningSpacesSidebarProjection } from '@iconicedu/web/lib/spaces/builders/learning-space.builder';

const getLearningSpacesByOrg = vi.fn();
const getLearningSpaceChannelsByLearningSpaceIds = vi.fn();
const getLearningSpaceParticipantsByLearningSpaceIds = vi.fn();
const buildUserProfilesByIds = vi.fn();
const buildChannelById = vi.fn();

vi.mock('@iconicedu/web/lib/spaces/queries/learning-spaces.query', () => ({
  getLearningSpacesByOrg: (...args: unknown[]) => getLearningSpacesByOrg(...args),
  getLearningSpaceById: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/spaces/queries/learning-space-relations.query', () => ({
  getLearningSpaceChannelsByLearningSpaceIds: (...args: unknown[]) =>
    getLearningSpaceChannelsByLearningSpaceIds(...args),
  getLearningSpaceParticipantsByLearningSpaceIds: (...args: unknown[]) =>
    getLearningSpaceParticipantsByLearningSpaceIds(...args),
  getLearningSpaceChannelByChannelId: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfilesByIds: (...args: unknown[]) => buildUserProfilesByIds(...args),
}));

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelById(...args),
}));

vi.mock('@iconicedu/web/lib/schedules/builders/class-schedule.builder', () => ({
  buildClassScheduleById: vi.fn(),
}));

const makeChannelVM = (id: string) =>
  ({
    ids: { id, orgId: 'org-1' },
    basics: { kind: 'channel', purpose: 'learning-space' },
  }) as any;

describe('buildLearningSpacesSidebarProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves channels from the shared map instead of calling buildChannelById, and batches profile hydration once', async () => {
    getLearningSpacesByOrg.mockResolvedValue({
      data: [
        {
          id: 'space-1',
          org_id: 'org-1',
          kind: 'class',
          status: 'active',
          title: 'Math',
        },
        {
          id: 'space-2',
          org_id: 'org-1',
          kind: 'class',
          status: 'active',
          title: 'Science',
        },
      ],
    });
    getLearningSpaceChannelsByLearningSpaceIds.mockResolvedValue({
      data: [
        { learning_space_id: 'space-1', channel_id: 'channel-1', is_primary: true },
        { learning_space_id: 'space-1', channel_id: 'channel-2', is_primary: false },
        { learning_space_id: 'space-2', channel_id: 'channel-3', is_primary: true },
      ],
    });
    getLearningSpaceParticipantsByLearningSpaceIds.mockResolvedValue({
      data: [
        { learning_space_id: 'space-1', profile_id: 'profile-1' },
        { learning_space_id: 'space-2', profile_id: 'profile-2' },
      ],
    });
    buildUserProfilesByIds.mockResolvedValue(
      new Map([
        ['profile-1', { ids: { id: 'profile-1' } }],
        ['profile-2', { ids: { id: 'profile-2' } }],
      ]),
    );

    const channelsById = new Map([
      ['channel-1', makeChannelVM('channel-1')],
      ['channel-2', makeChannelVM('channel-2')],
      ['channel-3', makeChannelVM('channel-3')],
    ]);

    const results = await buildLearningSpacesSidebarProjection(
      {} as any,
      'org-1',
      channelsById,
    );

    // Channels come from the shared map, not from a per-channel fetch.
    expect(buildChannelById).not.toHaveBeenCalled();
    // Profile hydration batches across every space in one call.
    expect(buildUserProfilesByIds).toHaveBeenCalledTimes(1);
    expect(buildUserProfilesByIds).toHaveBeenCalledWith({}, 'org-1', [
      'profile-1',
      'profile-2',
    ]);

    expect(results).toHaveLength(2);
    const spaceOne = results.find((space) => space.ids.id === 'space-1');
    expect(spaceOne?.channels.primaryChannel.ids.id).toBe('channel-1');
    expect(spaceOne?.channels.relatedChannels?.map((channel) => channel.ids.id)).toEqual([
      'channel-2',
    ]);
    expect(spaceOne?.participants).toEqual([{ ids: { id: 'profile-1' } }]);
  });

  it('drops a learning space whose primary channel is missing from the shared map', async () => {
    getLearningSpacesByOrg.mockResolvedValue({
      data: [{ id: 'space-1', org_id: 'org-1', kind: 'class', status: 'active' }],
    });
    getLearningSpaceChannelsByLearningSpaceIds.mockResolvedValue({
      data: [
        { learning_space_id: 'space-1', channel_id: 'missing-channel', is_primary: true },
      ],
    });
    getLearningSpaceParticipantsByLearningSpaceIds.mockResolvedValue({ data: [] });
    buildUserProfilesByIds.mockResolvedValue(new Map());

    const results = await buildLearningSpacesSidebarProjection(
      {} as any,
      'org-1',
      new Map(),
    );

    expect(results).toEqual([]);
  });
});
