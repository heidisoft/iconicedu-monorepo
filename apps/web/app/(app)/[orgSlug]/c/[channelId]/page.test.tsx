import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/c/[channelId]/page';

const messagesShellMock = vi.fn(() => null);
const buildChannelByIdMock = vi.fn();
const enableMessageTypeComposerRunMock = vi.fn(async () => true);
const enableMessageMarkUnreadRunMock = vi.fn(async () => false);
const enableMessageReplyReferenceRunMock = vi.fn(async () => true);
const enableNotificationConversationControlsRunMock = vi.fn(async () => false);
const enableMessageListFormattingRunMock = vi.fn(async () => true);
const enableMessageDraftsRunMock = vi.fn(async () => false);
const enableMessageEditRunMock = vi.fn(async () => false);
const enableMessageSendReliabilityRunMock = vi.fn(async () => false);

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: () => null,
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client', () => ({
  MessagesShellClient: (props: unknown) => messagesShellMock(props),
}));

vi.mock('@iconicedu/web/app/actions/messages', () => ({
  editTextMessageAction: vi.fn(),
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

vi.mock('@iconicedu/web/flags', () => ({
  enableMessageTypeComposer: {
    run: (...args: unknown[]) => enableMessageTypeComposerRunMock(...args),
  },
  enableMessageMarkUnread: {
    run: (...args: unknown[]) => enableMessageMarkUnreadRunMock(...args),
  },
  enableMessageReplyReference: {
    run: (...args: unknown[]) => enableMessageReplyReferenceRunMock(...args),
  },
  enableNotificationConversationControls: {
    run: (...args: unknown[]) => enableNotificationConversationControlsRunMock(...args),
  },
  enableMessageListFormatting: {
    run: (...args: unknown[]) => enableMessageListFormattingRunMock(...args),
  },
  enableMessageDrafts: {
    run: (...args: unknown[]) => enableMessageDraftsRunMock(...args),
  },
  enableMessageEdit: {
    run: (...args: unknown[]) => enableMessageEditRunMock(...args),
  },
  enableMessageSendReliability: {
    run: (...args: unknown[]) => enableMessageSendReliabilityRunMock(...args),
  },
}));

describe('d/c/[channelId] page', () => {
  it('passes currentUserId to MessagesShell', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: {
        participants: [{ ids: { accountId: 'account-1' } }],
      },
    });
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

  it('threads the P1 messaging flags down to MessagesShellClient', async () => {
    buildChannelByIdMock.mockResolvedValueOnce({
      ids: { id: 'channel-1', orgId: 'org-1' },
      collections: {
        participants: [{ ids: { accountId: 'account-1' } }],
      },
    });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          enableMessageMarkUnread: false,
          enableMessageReplyReference: true,
          enableNotificationConversationControls: false,
          enableMessageListFormatting: true,
        }),
      );
    });

    expect(enableMessageMarkUnreadRunMock).toHaveBeenCalledWith({
      identify: { profileId: 'profile-1' },
    });
  });

  it('keeps staff observers writable even when they are not channel participants', async () => {
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
      collections: {
        participants: [{ ids: { accountId: 'account-2' } }],
      },
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
