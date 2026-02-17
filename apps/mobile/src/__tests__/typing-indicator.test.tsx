import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TypingIndicator } from '../components/messages/typing-indicator';

describe('TypingIndicator', () => {
  it('renders nothing when no users are typing', () => {
    const { toJSON } = render(<TypingIndicator typingUsers={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('shows single user typing', () => {
    render(<TypingIndicator typingUsers={['Alice']} />);
    expect(screen.getByText('Alice is typing...')).toBeTruthy();
  });

  it('shows two users typing', () => {
    render(<TypingIndicator typingUsers={['Alice', 'Bob']} />);
    expect(screen.getByText('Alice and Bob are typing...')).toBeTruthy();
  });

  it('shows multiple users with count', () => {
    render(
      <TypingIndicator typingUsers={['Alice', 'Bob', 'Charlie']} />,
    );
    expect(
      screen.getByText('Alice and 2 others are typing...'),
    ).toBeTruthy();
  });
});
