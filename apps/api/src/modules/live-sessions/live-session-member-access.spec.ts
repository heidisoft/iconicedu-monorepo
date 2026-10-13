import { LiveSessionsService } from './live-sessions.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import {
  verifyChannelMembership,
  resolveAuthorizedLiveSessionProfileIds,
  getLiveSessionProvider,
} from '@iconicedu/live-sessions-core';
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
  verifyChannelMembership: jest.fn(),
  resolveAuthorizedLiveSessionProfileIds: jest.fn(),
  getLiveSessionProvider: jest.fn(),
}));
describe('legacy meeting access', () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(createSupabaseServiceClient)
      .mockReturnValue({ from: () => query } as never);
    jest
      .mocked(loadAndAuthorizeProfile)
      .mockResolvedValue({ profile: { id: 'profile', kind: 'child' } } as never);
    jest.mocked(resolveAuthorizedLiveSessionProfileIds).mockResolvedValue(['profile']);
    jest.mocked(verifyChannelMembership).mockResolvedValue(true);
    query.maybeSingle
      .mockReset()
      .mockResolvedValueOnce({
        data: {
          id: 'session',
          org_id: 'org',
          channel_id: 'channel',
          provider: 'zoom',
          share_code: 'aaaabbbbcccc',
          status: 'live',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { topic: 'Class', purpose: 'learning-space', kind: 'channel' },
        error: null,
      })
      .mockResolvedValueOnce({ data: { slug: 'academy' }, error: null });
  });
  it('returns only routing information for Zoom, never credentials that bypass admission', async () => {
    const result = await new LiveSessionsService().memberAccess('access', 'session', {
      orgId: 'org',
      profileId: 'profile',
    });
    expect(result).toEqual({
      provider: 'zoom',
      joinPath: '/live/aaaa-bbbb-cccc',
      returnPath: '/academy/s/channel',
    });
    expect(getLiveSessionProvider).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('org_id', 'org');
  });
  it('rejects nonmembers before routing', async () => {
    jest.mocked(verifyChannelMembership).mockResolvedValue(false);
    await expect(
      new LiveSessionsService().memberAccess('access', 'session', {
        orgId: 'org',
        profileId: 'profile',
      }),
    ).rejects.toThrow('Classroom access');
    expect(getLiveSessionProvider).not.toHaveBeenCalled();
  });
});
