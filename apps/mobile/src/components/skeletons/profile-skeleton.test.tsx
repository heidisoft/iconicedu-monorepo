import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProfileSkeleton } from './profile-skeleton';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { border: '#e2e8f0' } }),
}));

describe('ProfileSkeleton', () => {
  it('renders without crashing', () => {
    render(<ProfileSkeleton />);
  });

  it('has accessibilityLabel="Loading" on root', () => {
    render(<ProfileSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('renders 15 PulseBox + 1 root = 16 loading nodes', () => {
    render(<ProfileSkeleton />);
    // Profile card: 3 PulseBox; settings rows: 6 × 2 = 12; total = 15 + 1 root
    expect(screen.getAllByLabelText('Loading').length).toBe(16);
  });
});
