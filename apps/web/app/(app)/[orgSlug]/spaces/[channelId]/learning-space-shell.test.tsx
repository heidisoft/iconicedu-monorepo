import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LearningSpaceShell } from '@iconicedu/web/app/(app)/[orgSlug]/spaces/[channelId]/learning-space-shell';

const messagesShellMock = vi.fn(() => null);

vi.mock('@iconicedu/ui-web', () => ({
  LearningSpaceInfoPanel: () => null,
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client', () => ({
  MessagesShellClient: (props: unknown) => messagesShellMock(props),
}));

describe('LearningSpaceShell', () => {
  it('forwards currentUserId and message actions to MessagesShell', async () => {
    const sendTextMessage = vi.fn();
    const sendFileMessage = vi.fn();
    const sendFilesMessage = vi.fn();
    const toggleReaction = vi.fn();
    const toggleSavedMessage = vi.fn();
    const deleteMessage = vi.fn();
    const toggleHiddenMessage = vi.fn();

    render(
      <LearningSpaceShell
        orgSlug="iconic-academy"
        channel={{ ids: { id: 'channel-1', orgId: 'org-1' } } as unknown}
        learningSpace={null}
        currentUserId="profile-1"
        currentUserProfile={
          { ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' } } as unknown
        }
        showCreateMessageTypeButton={false}
        sendTextMessage={sendTextMessage}
        sendFileMessage={sendFileMessage}
        sendFilesMessage={sendFilesMessage}
        toggleReaction={toggleReaction}
        toggleSavedMessage={toggleSavedMessage}
        deleteMessage={deleteMessage}
        toggleHiddenMessage={toggleHiddenMessage}
      />,
    );

    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: 'profile-1',
          currentUserProfile: {
            ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
          },
          readOnly: false,
          showCreateMessageTypeButton: false,
          sendTextMessage,
          sendFileMessage,
          sendFilesMessage,
          toggleReaction,
          toggleSavedMessage,
          deleteMessage,
          toggleHiddenMessage,
        }),
      );
    });
  });

  it('forwards readOnly to MessagesShell', async () => {
    render(
      <LearningSpaceShell
        orgSlug="iconic-academy"
        channel={{ ids: { id: 'channel-1', orgId: 'org-1' } } as unknown}
        learningSpace={null}
        currentUserId="profile-1"
        readOnly
        sendTextMessage={vi.fn()}
        sendFileMessage={vi.fn()}
        sendFilesMessage={vi.fn()}
        toggleReaction={vi.fn()}
        toggleSavedMessage={vi.fn()}
        deleteMessage={vi.fn()}
        toggleHiddenMessage={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
        }),
      );
    });
  });
});
