import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/c/[channelId]/page';

const messagesShellMock = vi.fn(() => null);
const buildChannelByIdMock = vi.fn();

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
  })),
  getDashboardProfileContext: vi.fn(async () => ({
    profileResponse: { data: { id: 'profile-1' } },
    currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
  })),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: vi.fn(async () => ({ ids: { id: 'profile-1', orgId: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelByIdMock(...args),
}));

describe('d/c/[channelId] page', () => {
  it('passes currentUserId to MessagesShell', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: {
        participants: [{ ids: { accountId: 'account-1' } }],
      },
    });
    const element = await Page({ params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }) });
    render(element as React.ReactElement);
    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: 'profile-1',
          currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
          readOnly: false,
        }),
      );
    });
  });

  it('enables read-only mode for staff who are not channel participants', async () => {
    const { buildUserProfileById } = await import(
      '@iconicedu/web/lib/profile/builders/user-profile.builder'
    );
    vi.mocked(buildUserProfileById).mockResolvedValueOnce({
      kind: 'staff',
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
    } as any);
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: {
        participants: [{ ids: { accountId: 'account-2' } }],
      },
    });

    const element = await Page({ params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }) });
    render(element as React.ReactElement);
    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
        }),
      );
    });
  });
});
