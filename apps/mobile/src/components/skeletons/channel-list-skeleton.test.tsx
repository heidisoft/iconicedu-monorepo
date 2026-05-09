import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ChannelListSkeleton } from './channel-list-skeleton';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { border: '#e2e8f0' } }),
}));

describe('ChannelListSkeleton', () => {
  it('renders without crashing', () => {
    render(<ChannelListSkeleton />);
  });

  it('has accessibilityLabel="Loading" on root', () => {
    render(<ChannelListSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('renders the message-list skeleton rows with the expected structure', () => {
    render(<ChannelListSkeleton />);

    expect(screen.getByTestId('channel-list-skeleton')).toBeTruthy();
    expect(screen.getAllByTestId('channel-skeleton-row')).toHaveLength(6);
    expect(screen.queryByTestId('channel-skeleton-status-dot')).toBeNull();
  });

  it('renders custom count of rows', () => {
    render(<ChannelListSkeleton count={3} />);
    expect(screen.getAllByTestId('channel-skeleton-row')).toHaveLength(3);
  });
});
