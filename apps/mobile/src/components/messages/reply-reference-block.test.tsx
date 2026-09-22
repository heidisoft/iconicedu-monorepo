import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ReplyReferenceBlock } from './reply-reference-block';
import { lightColors } from '@/lib/theme';

describe('ReplyReferenceBlock', () => {
  it('renders the sender name and snippet', () => {
    render(
      <ReplyReferenceBlock
        replyTo={{
          messageId: 'msg-1',
          senderId: 'user-1',
          senderName: 'Jamie Lee',
          snippet: 'Sounds good, see you then!',
          type: 'text',
        }}
        colors={lightColors}
      />,
    );

    expect(screen.getByText('Jamie Lee')).toBeTruthy();
    expect(screen.getByText('Sounds good, see you then!')).toBeTruthy();
  });

  it('calls onPress with the original message id when tapped', () => {
    const onPress = jest.fn();
    render(
      <ReplyReferenceBlock
        replyTo={{
          messageId: 'msg-1',
          senderId: 'user-1',
          senderName: 'Jamie Lee',
          snippet: 'Sounds good',
          type: 'text',
        }}
        colors={lightColors}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('reply-reference-block'));
    expect(onPress).toHaveBeenCalledWith('msg-1');
  });

  it('shows an "unavailable" state and disables tapping when the original was deleted', () => {
    const onPress = jest.fn();
    render(
      <ReplyReferenceBlock
        replyTo={{
          messageId: 'msg-1',
          senderId: 'user-1',
          senderName: 'Jamie Lee',
          snippet: 'Sounds good',
          type: 'text',
          isUnavailable: true,
        }}
        colors={lightColors}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Original message unavailable')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reply-reference-block'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not crash when onPress is not provided', () => {
    render(
      <ReplyReferenceBlock
        replyTo={{
          messageId: 'msg-1',
          senderId: 'user-1',
          senderName: 'Jamie Lee',
          snippet: 'Sounds good',
          type: 'text',
        }}
        colors={lightColors}
      />,
    );

    expect(() =>
      fireEvent.press(screen.getByTestId('reply-reference-block')),
    ).not.toThrow();
  });
});
