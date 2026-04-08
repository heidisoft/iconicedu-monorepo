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

  it('renders default 5 rows — 23 PulseBox + 1 root = 24 loading nodes', () => {
    render(<ChannelListSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBe(24);
  });

  it('renders custom count of rows', () => {
    render(<ChannelListSkeleton count={3} />);
    // i=0: 5, i=1: 4, i=2: 5 -> 14 PulseBox + 1 root = 15
    expect(screen.getAllByLabelText('Loading').length).toBe(15);
  });
});
