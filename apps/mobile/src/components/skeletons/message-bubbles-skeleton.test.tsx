import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageBubblesSkeleton } from './message-bubbles-skeleton';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { border: '#e2e8f0' } }),
}));

describe('MessageBubblesSkeleton', () => {
  it('renders without crashing', () => {
    render(<MessageBubblesSkeleton />);
  });

  it('has accessibilityLabel="Loading" on root', () => {
    render(<MessageBubblesSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('renders 8 PulseBox + 1 root = 9 loading nodes', () => {
    render(<MessageBubblesSkeleton />);
    // 3 "other" (avatar + bubble = 2 each) + 2 "own" (bubble = 1 each) = 8 PulseBox + 1 root
    expect(screen.getAllByLabelText('Loading').length).toBe(9);
  });
});
