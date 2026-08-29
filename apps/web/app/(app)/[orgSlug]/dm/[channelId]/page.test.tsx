import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/dm/[channelId]/page';

const messagesShellMock = vi.fn(() => null);
const redirectMock = vi.fn();
const notFoundMock = vi.fn();
const ensureDmMock = vi.fn();
const buildChannelByIdMock = vi.fn();
const buildChannelByDmKeyMock = vi.fn();
const resolveOrgDashboardPathMock = vi.fn(async () => '/iconic-academy');
const enableMessageTypeComposerRunMock = vi.fn(async () => true);

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

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client', () => ({
  MessagesShellClient: (props: unknown) => messagesShellMock(props),
}));

vi.mock('@iconicedu/web/app/actions/messages', () => ({
  sendFileMessageAction: vi.fn(),
  sendFilesMessageAction: vi.fn(),
  sendTextMessageAction: vi.fn(),
  toggleMessageReactionAction: vi.fn(),
  toggleSavedMessageAction: vi.fn(),
  deleteMessageAction: vi.fn(),
  toggleHiddenMessageAction: vi.fn(),
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth', () => ({
  getDashboardAccountContext: vi.fn(async () => ({
    supabase: {},
    account: { id: 'account-1', org_id: 'org-1' },
    dashboardPath: '/iconic-academy',
  })),
  getDashboardProfileContext: vi.fn(async () => ({
    profileResponse: { data: { id: 'profile-1' } },
    currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
  })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileById: vi.fn(async () => ({ data: { id: 'profile-2', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelByIdMock(...args),
  buildChannelByDmKey: (...args: unknown[]) => buildChannelByDmKeyMock(...args),
}));

vi.mock('@iconicedu/web/lib/channels/actions/ensure-direct-message-channel', () => ({
  ensureDirectMessageChannel: (...args: unknown[]) => ensureDmMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: (...args: unknown[]) => resolveOrgDashboardPathMock(...args),
}));

vi.mock('@iconicedu/web/flags', () => ({
  enableMessageTypeComposer: {
    run: (...args: unknown[]) => enableMessageTypeComposerRunMock(...args),
  },
}));

describe('d/dm/[channelId] page', () => {
  beforeEach(() => {
    resolveOrgDashboardPathMock.mockClear();
    resolveOrgDashboardPathMock.mockResolvedValue('/iconic-academy');
  });

  it('passes currentUserId to MessagesShell', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: { kind: 'dm' },
      collections: { participants: [] },
    });
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    });
    render(element as React.ReactElement);
    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: 'profile-1',
          currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
          readOnly: false,
          showCreateMessageTypeButton: true,
        }),
      );
    });
  });

  it('redirects to a created dm channel when channelId is a user id', async () => {
    buildChannelByIdMock.mockResolvedValueOnce(null);
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    ensureDmMock.mockResolvedValueOnce({ channelId: 'channel-new' });

    await expect(
      Page({
        params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'profile-2' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(ensureDmMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/iconic-academy/dm/channel-new');
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
    const { getDashboardProfileContext } =
      await import('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth');
    vi.mocked(getDashboardProfileContext).mockResolvedValueOnce({
      profileResponse: { data: { id: 'profile-1' } },
      currentUserProfile: {
        kind: 'guardian',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
        children: {
          items: [
            { ids: { id: 'profile-child', orgId: 'org-1', accountId: 'account-child' } },
          ],
        },
      } as unknown,
    });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
        }),
      );
    });
  });

  it('keeps staff observers writable when observing a dm they do not participate in', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: { kind: 'dm' },
      collections: {
        participants: [
          { ids: { accountId: 'account-2' } },
          { ids: { accountId: 'account-3' } },
        ],
      },
    });
    buildChannelByDmKeyMock.mockResolvedValueOnce(null);
    const { getDashboardProfileContext } =
      await import('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth');
    vi.mocked(getDashboardProfileContext).mockResolvedValueOnce({
      profileResponse: { data: { id: 'profile-1' } },
      currentUserProfile: {
        kind: 'staff',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      } as unknown,
    });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: false,
        }),
      );
    });
  });
});
