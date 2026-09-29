import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import { createOrJoinLiveSession } from '@iconicedu/live-sessions-core';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/actor/resolve-actor-profile', () => ({
  loadAndAuthorizeProfile: jest.fn(),
}));

jest.mock('@iconicedu/live-sessions-core', () => ({
  createOrJoinLiveSession: jest.fn(),
}));

describe('LiveSessionsService.joinLiveSession', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);
  const loadAndAuthorizeProfileMock = jest.mocked(loadAndAuthorizeProfile);
  const createOrJoinLiveSessionMock = jest.mocked(createOrJoinLiveSession);

  const input = { orgId: 'org-1', profileId: 'profile-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({
          data: { slug: 'iconic-academy' },
          error: null,
        })),
      })),
    } as never);
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
  });

  it('joins a live session once the acting profile is authorized', async () => {
    loadAndAuthorizeProfileMock.mockResolvedValue({
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' } as never,
      account: { id: 'account-1', org_id: 'org-1' },
    });
    createOrJoinLiveSessionMock.mockResolvedValue({
      sessionId: 'session-1',
      joinPath: '/iconic-academy/live-sessions/session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });

    const service = new LiveSessionsService();
    const result = await service.joinLiveSession('token-1', 'channel-1', input);

    expect(result).toEqual({
      sessionId: 'session-1',
      joinPath: '/iconic-academy/live-sessions/session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });
    expect(createOrJoinLiveSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-1',
        orgSlug: 'iconic-academy',
        actor: expect.objectContaining({
          authUserId: 'auth-user-1',
          account: { id: 'account-1', org_id: 'org-1' },
        }),
      }),
    );
  });

  it('rejects when the caller is not authorized to act as the profile', async () => {
    loadAndAuthorizeProfileMock.mockRejectedValue(new ForbiddenException('Unauthorized'));

    const service = new LiveSessionsService();
    await expect(
      service.joinLiveSession('token-1', 'channel-1', input),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createOrJoinLiveSessionMock).not.toHaveBeenCalled();
  });

  it('maps a missing channel to a 400', async () => {
    loadAndAuthorizeProfileMock.mockResolvedValue({
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' } as never,
      account: { id: 'account-1', org_id: 'org-1' },
    });
    createOrJoinLiveSessionMock.mockRejectedValue(new Error('Channel not found'));

    const service = new LiveSessionsService();
    await expect(
      service.joinLiveSession('token-1', 'channel-1', input),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps an unauthorized join-time error to a 403', async () => {
    loadAndAuthorizeProfileMock.mockResolvedValue({
      profile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' } as never,
      account: { id: 'account-1', org_id: 'org-1' },
    });
    createOrJoinLiveSessionMock.mockRejectedValue(new Error('Unauthorized'));

    const service = new LiveSessionsService();
    await expect(
      service.joinLiveSession('token-1', 'channel-1', input),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
