import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PulseBox } from './pulse-box';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { border: '#e2e8f0' } }),
}));

describe('PulseBox', () => {
  it('renders without crashing', () => {
    render(<PulseBox width={52} height={52} />);
  });

  it('has accessibilityLabel="Loading"', () => {
    render(<PulseBox width={100} height={20} />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('accepts custom radius', () => {
    render(<PulseBox width={52} height={52} radius={26} />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });
});
