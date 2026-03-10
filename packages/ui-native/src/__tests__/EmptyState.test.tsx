import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '@iconicedu/ui-native/components/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No messages" />);
    expect(screen.getByText('No messages')).toBeTruthy();
  });

  it('renders description', () => {
    render(<EmptyState title="No messages" description="Start a conversation" />);
    expect(screen.getByText('Start a conversation')).toBeTruthy();
  });

  it('renders action', () => {
    render(<EmptyState title="No messages" action={<Text>New Message</Text>} />);
    expect(screen.getByText('New Message')).toBeTruthy();
  });

  it('renders icon', () => {
    render(<EmptyState title="Empty" icon={<Text testID="icon">📭</Text>} />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('renders without optional props', () => {
    const { toJSON } = render(<EmptyState title="Empty" />);
    expect(toJSON()).toBeTruthy();
  });
});
