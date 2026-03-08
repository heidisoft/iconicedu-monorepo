import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ActivityFeedSkeleton } from './activity-feed-skeleton';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { border: '#e2e8f0', card: '#ffffff' } }),
}));

describe('ActivityFeedSkeleton', () => {
  it('renders without crashing', () => {
    render(<ActivityFeedSkeleton />);
  });

  it('has accessibilityLabel="Loading" on root', () => {
    render(<ActivityFeedSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('renders default 4 rows — 20 PulseBox + 1 root = 21 loading nodes', () => {
    render(<ActivityFeedSkeleton />);
    // i=0: avatar+headline+badge+meta+dot=5; i=1: avatar+headline+meta+dot+preview×2=6; i=2: 5; i=3: 4  → 20 + root
    expect(screen.getAllByLabelText('Loading').length).toBe(21);
  });

  it('renders custom count of rows', () => {
    render(<ActivityFeedSkeleton count={2} />);
    // i=0: 5 boxes; i=1: 6 boxes → 11 + root = 12
    expect(screen.getAllByLabelText('Loading').length).toBe(12);
  });
});
