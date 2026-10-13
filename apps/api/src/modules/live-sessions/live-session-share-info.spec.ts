jest.mock('./meeting-browser-links', () => ({
  issueMeetingLink: jest.fn(async () => 'synthetic-invitation-token'),
  resolveMeetingLink: jest.fn(),
  redeemMeetingHandoff: jest.fn(),
}));
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { loadAndAuthorizeProfile } from '@iconicedu/api/lib/actor/resolve-actor-profile';
import {
  verifyChannelMembership,
  resolveAuthorizedLiveSessionProfileIds,
} from '@iconicedu/live-sessions-core';
import { LiveSessionsService } from './live-sessions.service';
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
  getWebAppUrl: () => 'https://app.invalid',
}));
describe('authenticated meeting share details', () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  const input = { orgId: 'org', profileId: 'profile' };
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(createSupabaseServiceClient)
      .mockReturnValue({ from: () => query } as never);
    jest
      .mocked(loadAndAuthorizeProfile)
      .mockResolvedValue({ profile: { id: 'profile' } } as never);
    jest.mocked(resolveAuthorizedLiveSessionProfileIds).mockResolvedValue(['profile']);
    jest.mocked(verifyChannelMembership).mockResolvedValue(true);
    query.maybeSingle.mockResolvedValue({
      data: {
        id: 'session',
        org_id: 'org',
        channel_id: 'channel',
        share_code: 'a3f8b2d4c9e1',
        provider: 'zoom',
        provider_metadata: { passcode: 'test-secret' },
      },
      error: null,
    });
  });
  it('checks actor, tenant and classroom access before sharing a passcode', async () => {
    expect(
      await new LiveSessionsService().getShareInfo('token', 'A3F8-B2D4-C9E1', input),
    ).toEqual({
      provider: 'zoom',
      joinPath: 'https://app.invalid/live/a3f8-b2d4-c9e1',
      sharePath:
        'https://app.invalid/live/a3f8-b2d4-c9e1#invite=synthetic-invitation-token',
      passcode: 'test-secret',
    });
    expect(loadAndAuthorizeProfile).toHaveBeenCalledWith(expect.objectContaining(input));
    expect(query.eq).toHaveBeenCalledWith('org_id', 'org');
    expect(query.eq).toHaveBeenCalledWith('share_code', 'a3f8b2d4c9e1');
    expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    expect(verifyChannelMembership).toHaveBeenCalledWith(
      expect.anything(),
      'org',
      'channel',
      ['profile'],
    );
  });
  it('does not share passcodes with nonmembers', async () => {
    jest.mocked(verifyChannelMembership).mockResolvedValue(false);
    await expect(
      new LiveSessionsService().getShareInfo('token', 'a3f8-b2d4-c9e1', input),
    ).rejects.toThrow('Classroom access is required');
  });
  it('does not share passcodes for missing or cross-tenant sessions', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      new LiveSessionsService().getShareInfo('token', 'a3f8-b2d4-c9e1', input),
    ).rejects.toThrow('Live session not found');
    expect(verifyChannelMembership).not.toHaveBeenCalled();
  });
  it('rejects malformed locators before reading meeting data', async () => {
    await expect(
      new LiveSessionsService().getShareInfo('token', 'invalid', input),
    ).rejects.toThrow('Live session not found');
    expect(query.select).not.toHaveBeenCalled();
  });
});
