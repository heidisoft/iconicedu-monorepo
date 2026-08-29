import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/s/[channelId]/page';

const learningSpaceShellMock = vi.fn(() => null);
const buildChannelByIdMock = vi.fn();
const enableMessageTypeComposerRunMock = vi.fn(async () => true);

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: () => null,
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/s/[channelId]/learning-space-shell', () => ({
  LearningSpaceShell: (props: unknown) => learningSpaceShellMock(props),
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

vi.mock('@iconicedu/web/lib/channels/builders/channel.builder', () => ({
  buildChannelById: (...args: unknown[]) => buildChannelByIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/spaces/builders/learning-space.builder', () => ({
  buildLearningSpaceByChannelId: vi.fn(async () => null),
}));

vi.mock('@iconicedu/web/flags', () => ({
  enableMessageTypeComposer: {
    run: (...args: unknown[]) => enableMessageTypeComposerRunMock(...args),
  },
}));

describe('d/s/[channelId] page', () => {
  it('passes currentUserId to LearningSpaceShell', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: { participants: [{ ids: { accountId: 'account-1' } }] },
    });
    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    });
    render(element as React.ReactElement);
    await waitFor(() => {
      expect(learningSpaceShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: 'profile-1',
          currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1' } },
          readOnly: false,
          showCreateMessageTypeButton: true,
        }),
      );
    });
  });

  it('keeps staff observers writable even when they are not class channel participants', async () => {
    const { getDashboardProfileContext } =
      await import('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth');
    vi.mocked(getDashboardProfileContext).mockResolvedValueOnce({
      profileResponse: { data: { id: 'profile-1' } },
      currentUserProfile: {
        kind: 'staff',
        ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      } as unknown,
    });
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: { participants: [{ ids: { accountId: 'account-2' } }] },
    });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    });
    render(element as React.ReactElement);
    await waitFor(() => {
      expect(learningSpaceShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: false,
        }),
      );
    });
  });
});
