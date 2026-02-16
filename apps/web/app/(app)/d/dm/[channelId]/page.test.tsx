import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/d/dm/[channelId]/page';

const messagesShellMock = vi.fn(() => null);
const redirectMock = vi.fn();
const notFoundMock = vi.fn();
const ensureDmMock = vi.fn();
const buildChannelByIdMock = vi.fn();
const buildChannelByDmKeyMock = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundMock();
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: () => null,
}));

vi.mock('@iconicedu/web/app/(app)/d/messages/messages-shell-client', () => ({
  MessagesShellClient: (props: unknown) => messagesShellMock(props),
}));

vi.mock('@iconicedu/web/app/actions/messages', () => ({
  sendTextMessageAction: vi.fn(),
  toggleMessageReactionAction: vi.fn(),
  deleteMessageAction: vi.fn(),
  toggleHiddenMessageAction: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user', email: 'test@example.com' })),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: vi.fn(async () => ({ account: { id: 'account-1', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(async () => ({ data: { id: 'profile-1' } })),
  getProfileById: vi.fn(async () => ({ data: { id: 'profile-2', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: vi.fn(async () => ({ ids: { id: 'profile-1', orgId: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelByIdMock(...args),
  buildChannelByDmKey: (...args: unknown[]) => buildChannelByDmKeyMock(...args),
}));

vi.mock('@iconicedu/web/lib/channels/actions/ensure-direct-message-channel', () => ({
  ensureDirectMessageChannel: (...args: unknown[]) => ensureDmMock(...args),
}));

describe('d/dm/[channelId] page', () => {
  it('passes currentUserId to MessagesShell', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: { kind: 'dm' },
      collections: { participants: [] },
    });
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    const element = await Page({ params: Promise.resolve({ channelId: 'channel-1' }) });
    render(element as React.ReactElement);
    expect(messagesShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: 'profile-1',
        currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
        readOnly: false,
      }),
    );
  });

  it('redirects to a created dm channel when channelId is a user id', async () => {
    buildChannelByIdMock.mockResolvedValueOnce(null);
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    ensureDmMock.mockResolvedValueOnce({ channelId: 'channel-new' });

    await expect(
      Page({ params: Promise.resolve({ channelId: 'profile-2' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(ensureDmMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/d/dm/channel-new');
  });

  it('enables read-only mode for supervised guardian dm channels', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: { kind: 'dm' },
      collections: {
        participants: [
          { ids: { accountId: 'account-child' } },
          { ids: { accountId: 'account-other' } },
        ],
      },
    });
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    const { buildUserProfileById } = await import(
      '@iconicedu/web/lib/profile/builders/user-profile.builder'
    );
    vi.mocked(buildUserProfileById).mockResolvedValueOnce({
      kind: 'guardian',
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      children: {
        items: [{ ids: { id: 'profile-child', orgId: 'org-1', accountId: 'account-child' } }],
      },
    } as any);

    const element = await Page({ params: Promise.resolve({ channelId: 'channel-1' }) });
    render(element as React.ReactElement);

    expect(messagesShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readOnly: true,
      }),
    );
  });
});
