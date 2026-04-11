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

  it('renders 21 PulseBox + 1 root = 22 loading nodes', () => {
    render(<ProfileSkeleton />);
    expect(screen.getAllByLabelText('Loading').length).toBe(22);
  });
});
