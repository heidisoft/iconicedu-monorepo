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

  it('renders the notifications content skeleton structure', () => {
    render(<ActivityFeedSkeleton />);
    expect(screen.getByTestId('activity-feed-skeleton')).toBeTruthy();
    expect(screen.getAllByTestId('activity-skeleton-row')).toHaveLength(3);
    expect(screen.getAllByTestId('activity-skeleton-icon')).toHaveLength(3);
    expect(screen.getAllByTestId('activity-skeleton-preview-card')).toHaveLength(3);
    expect(screen.getAllByTestId('activity-skeleton-action')).toHaveLength(3);
  });

  it('renders custom count with the same row structure', () => {
    render(<ActivityFeedSkeleton count={2} />);
    expect(screen.getAllByTestId('activity-skeleton-row')).toHaveLength(2);
    expect(screen.getAllByTestId('activity-skeleton-action')).toHaveLength(2);
  });
});
