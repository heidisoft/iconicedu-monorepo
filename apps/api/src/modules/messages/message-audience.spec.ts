import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveChannelAudienceVisibility } from './messages.service';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';

jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  apiFeatureFlagKeys: {
    enableChannelCommunications: 'enable-channel-communications',
  },
  evaluateApiBooleanFlag: jest.fn(),
}));

function queryReturning<T>(result: { data: T; error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    is: jest.fn(() => chain),
    returns: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
  };
  return chain;
}

const base = {
  activityContext: {
    scope: { kind: 'channel' as const, channelId: 'channel-1' },
    channelRouteKind: 'channel' as const,
    channelPurpose: 'learning-space',
  },
  orgId: 'org-1',
  channelId: 'channel-1',
  senderProfileId: 'staff-1',
  supportVisibility: { visibility_type: 'all' as const },
};

describe('resolveChannelAudienceVisibility', () => {
  beforeEach(() => {
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true);
  });

  it('stores a staff-selected audience as explicit members plus the sender', async () => {
    const memberQuery = queryReturning({
      data: [{ profile_id: 'parent-1' }, { profile_id: 'tutor-1' }],
      error: null,
    });
    const result = await resolveChannelAudienceVisibility({
      ...base,
      serviceSupabase: { from: jest.fn(() => memberQuery) } as never,
      requestedProfileIds: ['parent-1', 'tutor-1', 'parent-1'],
    });
    expect(result).toEqual({
      visibility_type: 'specific-users',
      visibility_user_ids: ['staff-1', 'parent-1', 'tutor-1'],
    });
  });

  it('inherits the exact parent audience for a thread reply', async () => {
    const parentQuery = queryReturning({
      data: {
        visibility_type: 'specific-users',
        visibility_user_ids: ['staff-1', 'parent-1'],
      },
      error: null,
    });
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn(() => parentQuery) } as never,
        threadParentId: 'parent-message-1',
      }),
    ).resolves.toEqual({
      visibility_type: 'specific-users',
      visibility_user_ids: ['staff-1', 'parent-1'],
    });
  });

  it('inherits a restricted audience for a quoted reply', async () => {
    const parentQuery = queryReturning({
      data: {
        visibility_type: 'specific-users',
        visibility_user_ids: ['staff-1', 'parent-1'],
      },
      error: null,
    });
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn(() => parentQuery) } as never,
        replyToMessageId: 'quoted-message-1',
      }),
    ).resolves.toEqual({
      visibility_type: 'specific-users',
      visibility_user_ids: ['staff-1', 'parent-1'],
    });
  });

  it('rejects an empty audience and profiles outside the channel', async () => {
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn() } as never,
        requestedProfileIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const memberQuery = queryReturning({
      data: [{ profile_id: 'parent-1' }],
      error: null,
    });
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn(() => memberQuery) } as never,
        requestedProfileIds: ['parent-1', 'outsider-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects audience selection in direct messages', async () => {
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn() } as never,
        activityContext: { ...base.activityContext, channelRouteKind: 'dm' },
        requestedProfileIds: ['parent-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows any channel member to choose an audience', async () => {
    const memberQuery = queryReturning({
      data: [{ profile_id: 'tutor-1' }],
      error: null,
    });
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn(() => memberQuery) } as never,
        senderProfileId: 'parent-1',
        requestedProfileIds: ['tutor-1'],
      }),
    ).resolves.toEqual({
      visibility_type: 'specific-users',
      visibility_user_ids: ['parent-1', 'tutor-1'],
    });
  });

  it('rejects disabled-flag audience requests', async () => {
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn() } as never,
        requestedProfileIds: ['parent-1'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
