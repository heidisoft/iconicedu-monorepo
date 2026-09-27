import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PinnedMessagesSheet } from '@/components/messages/pinned-messages-sheet';
import type { MessageVM } from '@iconicedu/shared-types';

const mockFetchPinnedMessages = jest.fn();
const mockToggleMessagePin = jest.fn();

jest.mock('@/lib/api/queries', () => ({
  fetchPinnedMessages: (...args: unknown[]) => mockFetchPinnedMessages(...args),
  toggleMessagePin: (...args: unknown[]) => mockToggleMessagePin(...args),
}));

function makeMessage(id: string, text: string): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: {
        kind: 'educator',
        ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
        profile: { displayName: 'John Doe', avatar: { source: 'seed', seed: 'john' } },
      },
      createdAt: '2025-01-15T10:30:00Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text },
  } as unknown as MessageVM;
}

describe('PinnedMessagesSheet (issue #264 P2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and renders pinned messages with who pinned them and when', async () => {
    mockFetchPinnedMessages.mockResolvedValue([
      {
        message: makeMessage('pin-1', 'Please review the syllabus'),
        pinnedBy: { profile: { displayName: 'Alice Chen' } },
        pinnedAt: '2025-01-16T09:00:00.000Z',
      },
    ]);

    render(
      <PinnedMessagesSheet
        visible
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Please review the syllabus')).toBeTruthy();
    });
    expect(screen.getByText(/Pinned by Alice Chen/)).toBeTruthy();
  });

  it('shows an empty state when there are no pinned messages', async () => {
    mockFetchPinnedMessages.mockResolvedValue([]);

    render(
      <PinnedMessagesSheet
        visible
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No pinned messages')).toBeTruthy();
    });
  });

  it('unpins a message and removes it from the list, refreshing after the toggle', async () => {
    mockFetchPinnedMessages.mockResolvedValue([
      {
        message: makeMessage('pin-1', 'Please review the syllabus'),
        pinnedBy: { profile: { displayName: 'Alice Chen' } },
        pinnedAt: '2025-01-16T09:00:00.000Z',
      },
    ]);
    mockToggleMessagePin.mockResolvedValue(undefined);

    render(
      <PinnedMessagesSheet
        visible
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Please review the syllabus')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Unpin message'));

    await waitFor(() => {
      expect(mockToggleMessagePin).toHaveBeenCalledWith({
        orgId: 'org-1',
        channelId: 'chan-1',
        messageId: 'pin-1',
        isPinned: false,
        profileId: 'prof-1',
      });
    });
    await waitFor(() => {
      expect(screen.queryByText('Please review the syllabus')).toBeNull();
    });
  });

  it('shows an alert and keeps the row when unpin fails', async () => {
    mockFetchPinnedMessages.mockResolvedValue([
      {
        message: makeMessage('pin-1', 'Please review the syllabus'),
        pinnedBy: { profile: { displayName: 'Alice Chen' } },
        pinnedAt: '2025-01-16T09:00:00.000Z',
      },
    ]);
    mockToggleMessagePin.mockRejectedValue(new Error('Network error'));

    render(
      <PinnedMessagesSheet
        visible
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Please review the syllabus')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Unpin message'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to unpin message',
        'Network error',
      );
    });
    expect(screen.getByText('Please review the syllabus')).toBeTruthy();
  });

  it('does not fetch when not visible', () => {
    render(
      <PinnedMessagesSheet
        visible={false}
        orgId="org-1"
        channelId="chan-1"
        profileId="prof-1"
        accountId="acc-1"
        onClose={jest.fn()}
      />,
    );

    expect(mockFetchPinnedMessages).not.toHaveBeenCalled();
  });
});
