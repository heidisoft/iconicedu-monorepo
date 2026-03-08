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

  it('renders default 5 rows — 20 PulseBox + 1 root = 21 loading nodes', () => {
    render(<ChannelListSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBe(21);
  });

  it('renders custom count of rows', () => {
    render(<ChannelListSkeleton count={3} />);
    // 3 rows × 4 PulseBox + 1 root = 13
    expect(screen.getAllByLabelText('Loading').length).toBe(13);
  });
});
