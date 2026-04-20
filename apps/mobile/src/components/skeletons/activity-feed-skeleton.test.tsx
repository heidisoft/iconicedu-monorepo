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

  it('renders default 4 rows with 2 section headers — 24 PulseBox + 1 root = 25 loading nodes', () => {
    render(<ActivityFeedSkeleton />);
    // 2 sections × 1 header + items (i=0 → 6, i=1 → 5, i=2 → 6, i=3 → 5 = 22) = 24 + root
    expect(screen.getAllByLabelText('Loading').length).toBe(25);
  });

  it('renders custom count with multi-section structure', () => {
    render(<ActivityFeedSkeleton count={2} />);
    // 2 sections × 1 header + items (i=0 section1 → 6, i=1 section2 → 5 = 11) = 13 + root
    expect(screen.getAllByLabelText('Loading').length).toBe(14);
  });
});
