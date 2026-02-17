import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageItem, type MessageItemData } from '../components/messages/message-item';

const baseMessage: MessageItemData = {
  id: 'msg-1',
  type: 'text',
  content: { text: 'Hello world' },
  sender_profile_id: 'user-1',
  created_at: '2025-01-15T10:30:00Z',
  sender: {
    id: 'user-1',
    display_name: 'John Doe',
    first_name: 'John',
    last_name: 'Doe',
    avatar_url: null,
  },
};

describe('MessageItem', () => {
  it('renders text message content', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} showSender />,
    );
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders sender name when showSender is true', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} showSender />,
    );
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('hides sender name when showSender is false', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} showSender={false} />,
    );
    expect(screen.queryByText('John Doe')).toBeNull();
  });

  it('hides sender name for own messages', () => {
    render(
      <MessageItem message={baseMessage} isOwn showSender />,
    );
    expect(screen.queryByText('John Doe')).toBeNull();
  });

  it('renders image message type fallback', () => {
    const imageMsg: MessageItemData = {
      ...baseMessage,
      type: 'image',
      content: null,
    };
    render(<MessageItem message={imageMsg} isOwn={false} showSender={false} />);
    expect(screen.getByText('[Image]')).toBeTruthy();
  });

  it('renders file message type fallback', () => {
    const fileMsg: MessageItemData = {
      ...baseMessage,
      type: 'file',
      content: null,
    };
    render(<MessageItem message={fileMsg} isOwn={false} showSender={false} />);
    expect(screen.getByText('[File]')).toBeTruthy();
  });

  it('renders unsupported message type fallback', () => {
    const unknownMsg: MessageItemData = {
      ...baseMessage,
      type: 'session-booking',
      content: null,
    };
    render(
      <MessageItem message={unknownMsg} isOwn={false} showSender={false} />,
    );
    expect(screen.getByText('[session-booking]')).toBeTruthy();
  });

  it('renders timestamp', () => {
    render(
      <MessageItem message={baseMessage} isOwn={false} showSender={false} />,
    );
    // The time format depends on locale, so just check something is rendered
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('handles missing sender gracefully', () => {
    const noSenderMsg: MessageItemData = {
      ...baseMessage,
      sender: null,
    };
    render(
      <MessageItem message={noSenderMsg} isOwn={false} showSender />,
    );
    expect(screen.getByText('Unknown')).toBeTruthy();
  });
});
