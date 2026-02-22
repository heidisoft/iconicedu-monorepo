import React from 'react';
import { render } from '@testing-library/react';
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
  it('forwards currentUserId and message actions to MessagesShell', () => {
    const sendTextMessage = vi.fn();
    const toggleReaction = vi.fn();
    const deleteMessage = vi.fn();
    const toggleHiddenMessage = vi.fn();

    render(
      <LearningSpaceShell
        channel={{ ids: { id: 'channel-1', orgId: 'org-1' } } as any}
        learningSpace={null}
        currentUserId="profile-1"
        currentUserProfile={{ ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' } } as any}
        sendTextMessage={sendTextMessage}
        toggleReaction={toggleReaction}
        deleteMessage={deleteMessage}
        toggleHiddenMessage={toggleHiddenMessage}
      />,
    );

    expect(messagesShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: 'profile-1',
        currentUserProfile: { ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' } },
        readOnly: false,
        sendTextMessage,
        toggleReaction,
        deleteMessage,
        toggleHiddenMessage,
      }),
    );
  });

  it('forwards readOnly to MessagesShell', () => {
    render(
      <LearningSpaceShell
        channel={{ ids: { id: 'channel-1', orgId: 'org-1' } } as any}
        learningSpace={null}
        currentUserId="profile-1"
        readOnly
        sendTextMessage={vi.fn()}
        toggleReaction={vi.fn()}
        deleteMessage={vi.fn()}
        toggleHiddenMessage={vi.fn()}
      />,
    );

    expect(messagesShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readOnly: true,
      }),
    );
  });
});
