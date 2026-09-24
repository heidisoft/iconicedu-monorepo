import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { MessageVM } from '@iconicedu/shared-types';
import {
  isMessageEditEligible,
  MessageActionsSheet,
} from '@/components/messages/message-actions-sheet';

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

const noop = () => undefined;

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
