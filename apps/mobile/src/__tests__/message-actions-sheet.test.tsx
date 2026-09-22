import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessageActionsSheet } from '@/components/messages/message-actions-sheet';
import type { MessageVM } from '@iconicedu/shared-types';

const sender = {
  kind: 'educator',
  ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
  profile: {
    displayName: 'John Doe',
    avatar: { source: 'seed' as const, seed: 'john', url: null },
  },
  prefs: {},
  meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
} as unknown as MessageVM['core']['sender'];

const baseMessage: MessageVM = {
  ids: { id: 'msg-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender,
    createdAt: '2025-01-15T10:30:00Z',
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  state: {},
  content: { text: 'Hello world' },
} as unknown as MessageVM;

describe('MessageActionsSheet — pinning (issue #264 P2)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not show the pin action when enablePinning is false (flag-off inertness)', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={jest.fn()}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning={false}
      />,
    );

    expect(screen.queryByLabelText('Pin message')).toBeNull();
    expect(screen.queryByLabelText('Unpin message')).toBeNull();
  });

  it('shows "Pin message" when enabled and not yet pinned', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={jest.fn()}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning
        isPinned={false}
      />,
    );

    expect(screen.getByLabelText('Pin message')).toBeTruthy();
  });

  it('shows "Unpin message" when enabled and already pinned', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={jest.fn()}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning
        isPinned
      />,
    );

    expect(screen.getByLabelText('Unpin message')).toBeTruthy();
  });

  it('calls onTogglePin(messageId, true) and closes the sheet on success', async () => {
    const onTogglePin = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={onClose}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning
        isPinned={false}
        onTogglePin={onTogglePin}
      />,
    );

    fireEvent.press(screen.getByLabelText('Pin message'));

    await waitFor(() => {
      expect(onTogglePin).toHaveBeenCalledWith('msg-1', true);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onTogglePin(messageId, false) when unpinning', async () => {
    const onTogglePin = jest.fn().mockResolvedValue(undefined);

    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={jest.fn()}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning
        isPinned
        onTogglePin={onTogglePin}
      />,
    );

    fireEvent.press(screen.getByLabelText('Unpin message'));

    await waitFor(() => {
      expect(onTogglePin).toHaveBeenCalledWith('msg-1', false);
    });
  });

  it('surfaces a 403/cap error from onTogglePin via Alert instead of crashing, and keeps the sheet open', async () => {
    const onTogglePin = jest
      .fn()
      .mockRejectedValue(new Error('You do not have permission to pin messages here'));
    const onClose = jest.fn();

    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={onClose}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning
        isPinned={false}
        onTogglePin={onTogglePin}
      />,
    );

    fireEvent.press(screen.getByLabelText('Pin message'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to pin message',
        'You do not have permission to pin messages here',
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces the 25-pin cap error message from the server as-is', async () => {
    const onTogglePin = jest
      .fn()
      .mockRejectedValue(
        new Error('This channel already has the maximum of 25 pinned messages'),
      );

    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={jest.fn()}
        onReact={jest.fn()}
        onThread={jest.fn()}
        onDelete={jest.fn()}
        enablePinning
        isPinned={false}
        onTogglePin={onTogglePin}
      />,
    );

    fireEvent.press(screen.getByLabelText('Pin message'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to pin message',
        'This channel already has the maximum of 25 pinned messages',
      );
    });
  });
});
