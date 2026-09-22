import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MessageActionsSheet } from './message-actions-sheet';
import type { MessageVM } from '@iconicedu/shared-types';

const sender = {
  kind: 'educator',
  ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
  profile: { displayName: 'John Doe', avatar: { source: 'seed', seed: 'john' } },
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

function noop() {}

describe('MessageActionsSheet', () => {
  it('does not render a Quote reply row when onQuoteReply is not provided (flag off)', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
      />,
    );

    expect(screen.queryByText('Quote reply')).toBeNull();
  });

  it('shows Quote reply when onQuoteReply is provided and calls it with the message', () => {
    const onQuoteReply = jest.fn();
    const onClose = jest.fn();
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={onClose}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
        onQuoteReply={onQuoteReply}
      />,
    );

    fireEvent.press(screen.getByText('Quote reply'));
    expect(onQuoteReply).toHaveBeenCalledWith(baseMessage);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render a Mark unread row when onMarkUnread is not provided (flag off)', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
      />,
    );

    expect(screen.queryByText('Mark unread')).toBeNull();
  });

  it('shows Mark unread when provided and the channel is not already unread', () => {
    const onMarkUnread = jest.fn();
    const onClose = jest.fn();
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={onClose}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
        onMarkUnread={onMarkUnread}
        isChannelUnread={false}
      />,
    );

    fireEvent.press(screen.getByText('Mark unread'));
    expect(onMarkUnread).toHaveBeenCalledWith(baseMessage);
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Mark unread when the channel is already showing as unread', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
        onMarkUnread={jest.fn()}
        isChannelUnread={true}
      />,
    );

    expect(screen.queryByText('Mark unread')).toBeNull();
  });

  it('hides Quote reply and Mark unread in read-only mode even when handlers are provided', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn={false}
        isReadOnly
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
        onQuoteReply={jest.fn()}
        onMarkUnread={jest.fn()}
      />,
    );

    expect(screen.queryByText('Quote reply')).toBeNull();
    expect(screen.queryByText('Mark unread')).toBeNull();
  });
});
