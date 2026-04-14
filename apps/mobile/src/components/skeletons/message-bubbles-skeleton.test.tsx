import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MessageBubblesSkeleton } from './message-bubbles-skeleton';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { border: '#e2e8f0', pageBg: '#ffffff' } }),
}));

describe('MessageBubblesSkeleton', () => {
  it('renders without crashing', () => {
    render(<MessageBubblesSkeleton />);
  });

  it('has accessibilityLabel="Loading" on root', () => {
    render(<MessageBubblesSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('matches the message list skeleton structure with separators and grouped rows', () => {
    render(<MessageBubblesSkeleton />);

    expect(screen.getAllByTestId('message-skeleton-separator')).toHaveLength(2);
    expect(screen.getAllByTestId('message-skeleton-row-other')).toHaveLength(3);
    expect(screen.getAllByTestId('message-skeleton-row-own')).toHaveLength(2);
    expect(screen.getAllByLabelText('Loading')).toHaveLength(24);
  });
});
