import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { MessagesShellClient } from '@iconicedu/web/app/(app)/[orgSlug]/messages/messages-shell-client';

const messagesShellMock = vi.fn(() => null);
const realtimeClient = { subscribe: vi.fn() };

vi.mock('@iconicedu/ui-web', () => ({
  MessagesShell: (props: unknown) => messagesShellMock(props),
}));

vi.mock('@iconicedu/web/lib/messages/realtime/supabase-messages-realtime-client', () => ({
  createSupabaseMessagesRealtimeClient: () => realtimeClient,
}));

vi.mock('@iconicedu/web/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) })) },
  }),
}));

describe('MessagesShellClient', () => {
  it('passes realtime and write clients to MessagesShell', async () => {
    const sendTextMessage = vi.fn();
    const sendFileMessage = vi.fn();
    const toggleReaction = vi.fn();
    const deleteMessage = vi.fn();
    const toggleHiddenMessage = vi.fn();

    render(
      <MessagesShellClient
        channel={{
          ids: { id: 'channel-1', orgId: 'org-1' },
          collections: { participants: [] },
        } as any}
        currentUserId="profile-1"
        readOnly
        sendTextMessage={sendTextMessage}
        sendFileMessage={sendFileMessage}
        toggleReaction={toggleReaction}
        deleteMessage={deleteMessage}
        toggleHiddenMessage={toggleHiddenMessage}
      />,
    );

    await waitFor(() => {
      expect(messagesShellMock).toHaveBeenCalledWith(
        expect.objectContaining({
          realtimeClient,
          messageWriteClient: {
            sendTextMessage,
            toggleReaction,
            deleteMessage,
            toggleHiddenMessage,
          },
          uploadFileMessage: expect.any(Function),
          currentUserId: 'profile-1',
          readOnly: true,
        }),
      );
    });
  });
});
