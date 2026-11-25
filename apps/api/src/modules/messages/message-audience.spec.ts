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

describe('message audience role and boundary matrix', () => {
  beforeEach(() => jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true));

  it.each(['owner', 'admin', 'staff', 'guardian', 'child', 'educator'])(
    '%s can send to everyone or one exact member without broadcasting to their role',
    async (role) => {
      const from = jest.fn();
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          senderProfileId: role,
          serviceSupabase: { from } as never,
        }),
      ).resolves.toEqual({ visibility_type: 'all' });
      expect(from).not.toHaveBeenCalled();
      const memberQuery = queryReturning({
        data: [{ profile_id: 'parent-A' }],
        error: null,
      });
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          senderProfileId: role,
          serviceSupabase: { from: jest.fn(() => memberQuery) } as never,
          requestedProfileIds: [' parent-A ', 'parent-A'],
        }),
      ).resolves.toEqual({
        visibility_type: 'specific-users',
        visibility_user_ids: [role, 'parent-A'],
      });
      expect(memberQuery.eq).toHaveBeenCalledWith('org_id', base.orgId);
      expect(memberQuery.eq).toHaveBeenCalledWith('channel_id', base.channelId);
      expect(memberQuery.is).toHaveBeenCalledWith('deleted_at', null);
    },
  );
  it.each([null, [], [' ', ''], 'parent-A', 42, {}, ['parent-A', 42]])(
    'rejects malformed or empty explicit audience %j',
    async (requestedProfileIds) => {
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          serviceSupabase: { from: jest.fn() } as never,
          requestedProfileIds,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('rejects more than 100 distinct recipients before querying', async () => {
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn() } as never,
        requestedProfileIds: Array.from({ length: 101 }, (_, i) => `profile-${i}`),
      }),
    ).rejects.toThrow('at most 100');
  });
  it('does not duplicate a sender explicitly included in the selection', async () => {
    const query = queryReturning({
      data: [{ profile_id: 'staff-1' }, { profile_id: 'parent-1' }],
      error: null,
    });
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn(() => query) } as never,
        requestedProfileIds: ['staff-1', 'parent-1'],
      }),
    ).resolves.toEqual({
      visibility_type: 'specific-users',
      visibility_user_ids: ['staff-1', 'parent-1'],
    });
  });
  it.each(['threadParentId', 'replyToMessageId'])(
    '%s cannot widen a private audience',
    async (field) => {
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          serviceSupabase: { from: jest.fn() } as never,
          [field]: 'private-root',
          requestedProfileIds: ['excluded'],
        }),
      ).rejects.toThrow('inherit');
      const query = queryReturning({
        data: {
          visibility_type: 'specific-users',
          visibility_user_ids: ['staff-1', 'parent-1', 'parent-1'],
        },
        error: null,
      });
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          senderProfileId: 'parent-1',
          serviceSupabase: { from: jest.fn(() => query) } as never,
          [field]: 'private-root',
        }),
      ).resolves.toEqual({
        visibility_type: 'specific-users',
        visibility_user_ids: ['staff-1', 'parent-1'],
      });
      expect(query.eq).toHaveBeenCalledWith('org_id', base.orgId);
      expect(query.eq).toHaveBeenCalledWith('channel_id', base.channelId);
      expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    },
  );
  it.each([null, { visibility_type: 'specific-users', visibility_user_ids: [] }])(
    'fails closed for missing/deleted or invalid private reference %j',
    async (data) => {
      const query = queryReturning({ data, error: null });
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          serviceSupabase: { from: jest.fn(() => query) } as never,
          threadParentId: 'missing-root',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('keeps managed support visibility and refuses explicit recipients', async () => {
    const support = {
      ...base,
      activityContext: { ...base.activityContext, channelPurpose: 'support' },
      supportVisibility: {
        visibility_type: 'specific-users' as const,
        visibility_user_ids: ['owner', 'staff'],
      },
      serviceSupabase: { from: jest.fn() } as never,
    };
    await expect(resolveChannelAudienceVisibility(support)).resolves.toEqual(
      support.supportVisibility,
    );
    await expect(
      resolveChannelAudienceVisibility({ ...support, requestedProfileIds: ['outsider'] }),
    ).rejects.toThrow('managed');
  });
  it('still allows everyone when targeted messaging is disabled', async () => {
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn() } as never,
      }),
    ).resolves.toEqual({ visibility_type: 'all' });
  });
});

describe('audience lookup boundaries', () => {
  beforeEach(() => jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(true));
  it('accepts exactly 100 distinct recipients even with duplicate input', async () => {
    const ids = Array.from({ length: 100 }, (_, index) => `profile-${index}`);
    const query = queryReturning({
      data: ids.map((profile_id) => ({ profile_id })),
      error: null,
    });
    const resolved = await resolveChannelAudienceVisibility({
      ...base,
      serviceSupabase: { from: jest.fn(() => query) } as never,
      requestedProfileIds: [...ids, ids[0]],
    });
    expect(resolved.visibility_user_ids).toEqual(['staff-1', ...ids]);
  });
  it('inherits everyone for a public thread without requiring the audience rollout flag', async () => {
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);
    const query = queryReturning({
      data: { visibility_type: 'all', visibility_user_ids: null },
      error: null,
    });
    await expect(
      resolveChannelAudienceVisibility({
        ...base,
        serviceSupabase: { from: jest.fn(() => query) } as never,
        threadParentId: 'public-parent',
      }),
    ).resolves.toEqual({ visibility_type: 'all' });
  });
  it.each([false, true])(
    'never widens visibility when the %s reference/member lookup fails',
    async (isReply) => {
      const query = queryReturning({ data: null, error: null });
      const failure = { data: null, error: { message: 'Local lookup failed' } };
      query.maybeSingle.mockResolvedValue(failure as never);
      query.returns.mockResolvedValue(failure as never);
      await expect(
        resolveChannelAudienceVisibility({
          ...base,
          serviceSupabase: { from: jest.fn(() => query) } as never,
          ...(isReply
            ? { threadParentId: 'private-parent' }
            : { requestedProfileIds: ['parent-1'] }),
        }),
      ).rejects.toThrow('Local lookup failed');
    },
  );
});
