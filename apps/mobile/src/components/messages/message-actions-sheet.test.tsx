import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import { isMessageEditEligible, MessageActionsSheet } from './message-actions-sheet';

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

  it('hides Mark unread for your own message, even when the channel is not already unread', () => {
    render(
      <MessageActionsSheet
        visible
        message={baseMessage}
        isOwn
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
        onMarkUnread={jest.fn()}
        isChannelUnread={false}
      />,
    );

    expect(screen.queryByText('Mark unread')).toBeNull();
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

function makeTextMessage(overrides: Partial<MessageVM> = {}): MessageVM {
  return {
    ids: { id: 'msg-1', orgId: 'org-1' },
    core: {
      type: 'text',
      sender: {
        kind: 'educator',
        ids: { id: 'user-1', orgId: 'org-1', accountId: 'acc-1' },
        profile: { displayName: 'Jane', avatar: { source: 'seed', seed: 'jane' } },
      },
      createdAt: new Date().toISOString(),
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    content: { text: 'Hello world' },
    ...overrides,
  } as unknown as MessageVM;
}

describe('isMessageEditEligible', () => {
  it('is eligible for the sender’s own recent text message', () => {
    const message = makeTextMessage();
    expect(isMessageEditEligible(message, true)).toBe(true);
  });

  it('is not eligible for another sender’s message', () => {
    const message = makeTextMessage();
    expect(isMessageEditEligible(message, false)).toBe(false);
  });

  it('is not eligible for a non-text message', () => {
    const message = makeTextMessage({
      core: {
        type: 'file',
        sender: makeTextMessage().core.sender,
        createdAt: new Date().toISOString(),
        visibility: { type: 'all' },
      },
    });
    expect(isMessageEditEligible(message, true)).toBe(false);
  });

  it('is not eligible once the 15-minute edit window has passed', () => {
    const staleMessage = makeTextMessage({
      core: {
        type: 'text',
        sender: makeTextMessage().core.sender,
        createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        visibility: { type: 'all' },
      },
    });
    expect(isMessageEditEligible(staleMessage, true)).toBe(false);
  });
});

describe('MessageActionsSheet — Edit row', () => {
  it('does not show Edit when enableEdit is false, even for the sender’s own message', () => {
    render(
      <MessageActionsSheet
        visible
        message={makeTextMessage()}
        isOwn
        enableEdit={false}
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByText('Edit message')).toBeNull();
  });

  it('does not show Edit for someone else’s message even when enableEdit is true', () => {
    render(
      <MessageActionsSheet
        visible
        message={makeTextMessage()}
        isOwn={false}
        enableEdit
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByText('Edit message')).toBeNull();
  });

  it('shows Edit for the sender’s own eligible text message when enabled, and calls onEdit', () => {
    const onEdit = jest.fn();
    const onClose = jest.fn();
    const message = makeTextMessage();

    render(
      <MessageActionsSheet
        visible
        message={message}
        isOwn
        enableEdit
        onClose={onClose}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
        onEdit={onEdit}
      />,
    );

    fireEvent.press(screen.getByText('Edit message'));
    expect(onEdit).toHaveBeenCalledWith(message);
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Edit in read-only mode even for the sender’s own message', () => {
    render(
      <MessageActionsSheet
        visible
        message={makeTextMessage()}
        isOwn
        isReadOnly
        enableEdit
        onClose={noop}
        onReact={noop}
        onThread={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByText('Edit message')).toBeNull();
  });
});
