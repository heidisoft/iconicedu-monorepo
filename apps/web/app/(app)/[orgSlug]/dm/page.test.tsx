import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/dm/page';

const redirectMock = vi.fn();
const ensureDmMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => {
    const orgQuery = {
      eq: vi.fn(() => orgQuery),
      is: vi.fn(() => orgQuery),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'org-1',
          slug: 'iconic-academy',
          name: 'Iconic Academy',
        },
        error: null,
      })),
    };
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => orgQuery),
      })),
    };
  }),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user', email: 'test@example.com' })),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: vi.fn(async () => ({
    account: { id: 'account-1', org_id: 'org-1' },
  })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(async () => ({ data: { id: 'profile-1' } })),
  getProfileById: vi.fn(async () => ({ data: { id: 'profile-2', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/channels/actions/ensure-direct-message-channel', () => ({
  ensureDirectMessageChannel: (...args: unknown[]) => ensureDmMock(...args),
}));

const buildChannelByIdMock = vi.fn();
const buildChannelByDmKeyMock = vi.fn();
const buildDirectMessageChannelsWithMessagesMock = vi.fn();
const resolveOrgDashboardPathMock = vi.fn(async () => '/iconic-academy');

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelByIdMock(...args),
  buildChannelByDmKey: (...args: unknown[]) => buildChannelByDmKeyMock(...args),
  buildDirectMessageChannelsWithMessages: (...args: unknown[]) =>
    buildDirectMessageChannelsWithMessagesMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: (...args: unknown[]) => resolveOrgDashboardPathMock(...args),
}));

describe('d/dm page', () => {
  beforeEach(() => {
    resolveOrgDashboardPathMock.mockClear();
    resolveOrgDashboardPathMock.mockResolvedValue('/iconic-academy');
  });

  it('redirects to a provided dm channel id when it exists', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-9' },
      basics: { kind: 'dm' },
    });
    await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
      searchParams: { channelId: 'channel-9' },
    });
    expect(redirectMock).toHaveBeenCalledWith('/iconic-academy/dm/channel-9');
  });

  it('creates a dm channel when given a user id', async () => {
    buildChannelByIdMock.mockResolvedValueOnce(null);
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    ensureDmMock.mockResolvedValueOnce({ channelId: 'channel-new' });
    await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
      searchParams: { userId: 'profile-2' },
    });
    expect(ensureDmMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/iconic-academy/dm/channel-new');
  });
});
