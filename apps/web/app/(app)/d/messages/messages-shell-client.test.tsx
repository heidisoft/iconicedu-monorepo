import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { MessagesShellClient } from '@iconicedu/web/app/(app)/d/messages/messages-shell-client';

const messagesShellMock = vi.fn(() => null);
const realtimeClient = { subscribe: vi.fn() };

vi.mock('@iconicedu/ui-web', () => ({
  MessagesShell: (props: unknown) => messagesShellMock(props),
}));

vi.mock('@iconicedu/web/lib/messages/realtime/supabase-messages-realtime-client', () => ({
  createSupabaseMessagesRealtimeClient: () => realtimeClient,
}));

describe('MessagesShellClient', () => {
  it('passes realtime and write clients to MessagesShell', () => {
    const sendTextMessage = vi.fn();
    const toggleReaction = vi.fn();
    const deleteMessage = vi.fn();
    const toggleHiddenMessage = vi.fn();

    render(
      <MessagesShellClient
        channel={{ ids: { id: 'channel-1', orgId: 'org-1' } } as any}
        currentUserId="profile-1"
        sendTextMessage={sendTextMessage}
        toggleReaction={toggleReaction}
        deleteMessage={deleteMessage}
        toggleHiddenMessage={toggleHiddenMessage}
      />,
    );

    expect(messagesShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        realtimeClient,
        messageWriteClient: { sendTextMessage, toggleReaction, deleteMessage, toggleHiddenMessage },
        currentUserId: 'profile-1',
      }),
    );
  });
});
